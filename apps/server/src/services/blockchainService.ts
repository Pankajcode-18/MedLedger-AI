import { ethers } from 'ethers';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { stateStore } from '../models/stateStore.js';
import { IBlockchainBlock, IChainReceipt } from '../types/index.js';
import { batchLeaf, merkleTree } from './merkle.js';

/**
 * The record history ("ledger").
 *
 * Every upload and every sharing decision becomes one entry in a hash-linked list that is saved
 * with the rest of the server state (state.json), so it survives restarts. Each entry's hash
 * covers the previous entry's hash, so changing or removing an old entry breaks every link after it.
 *
 * When a HealthRecords contract is configured (HEALTH_RECORDS_CONTRACT_ADDRESS + CHAIN_RPC_URL +
 * CHAIN_PRIVATE_KEY), the same event is also written to Ethereum:
 *   - uploads            → registerRecordFor(patient, fileHash)
 *   - share / stop       → grantAccessFor / revokeAccessFor(patient, doctor)
 *   - a patient who confirmed in MetaMask already sent grantAccess / revokeAccess themselves;
 *     that transaction is recorded instead of sending a second one.
 * Transactions are sent in the background, one at a time, so a slow network never holds up the page.
 * With CHAIN_BATCH_SIZE > 1, uploads are instead anchored in batches: one Merkle root per transaction
 * (anchorBatch), and each entry keeps its own proof so it can be checked on the chain alone.
 * Without a contract the app runs on the local history alone ("simulated" mode).
 */

export const CONTRACT_ABI = [
  'function relayer() view returns (address)',
  'function registerRecord(bytes32 fileHash)',
  'function registerRecordFor(address patient, bytes32 fileHash)',
  'function grantAccess(address doctor)',
  'function grantAccessFor(address patient, address doctor)',
  'function revokeAccess(address doctor)',
  'function revokeAccessFor(address patient, address doctor)',
  'function hasAccess(address patient, address doctor) view returns (bool)',
  'function verifyRecord(bytes32 fileHash) view returns (bool)',
  'function getRecordDetails(bytes32 fileHash) view returns (address owner, uint256 timestamp)',
  'function anchorBatch(bytes32 root, uint32 count)',
  'function verifyBatchedRecord(address patient, bytes32 fileHash, bytes32 root, bytes32[] proof) view returns (bool)',
  'function getBatchDetails(bytes32 root) view returns (uint256 timestamp, uint256 count)',
  'event BatchAnchored(bytes32 indexed root, uint256 count, uint256 timestamp)',
  'event RecordAdded(address indexed patient, bytes32 indexed fileHash, uint256 timestamp)',
  'event AccessGranted(address indexed patient, address indexed doctor, uint256 timestamp)',
  'event AccessRevoked(address indexed patient, address indexed doctor, uint256 timestamp)'
];

const EXPLORERS: Record<number, { name: string; tx: string }> = {
  11155111: { name: 'Sepolia', tx: 'https://sepolia.etherscan.io/tx/' },
  1: { name: 'Ethereum', tx: 'https://etherscan.io/tx/' },
  31337: { name: 'Hardhat local', tx: '' },
  1337: { name: 'Localhost', tx: '' }
};

export const ENTRY_TYPES = {
  genesis: 'Record history started',
  record: 'Report fingerprint saved',
  grant: 'Shared with doctor',
  revoke: 'Stopped sharing with doctor'
} as const;

const ZERO = `0x${'0'.repeat(64)}`;
const PUBLIC_TEST_KEY = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
let warnedTestKey = false;

type Evidence = { method?: string; txHash?: string; blockNumber?: number };
type Job = { entry: IBlockchainBlock; send: (c: ethers.Contract) => Promise<ethers.TransactionResponse | null> };

const sha256 = (data: string | Buffer) => `0x${crypto.createHash('sha256').update(data).digest('hex')}`;

/** Stable JSON (sorted keys) so the entry hash can be recomputed later. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

export function entryHash(e: Pick<IBlockchainBlock, 'blockNumber' | 'type' | 'timestamp' | 'previousHash' | 'payload'>): string {
  return sha256(canonical({ n: e.blockNumber, type: e.type, t: e.timestamp, prev: e.previousHash, payload: e.payload || {} }));
}

export class BlockchainService {
  private contract: ethers.Contract | null = null;
  private chainId = config.walletChainId;
  private queue: Promise<void> = Promise.resolve();
  private started = false;
  /** Records waiting to be anchored together (batch mode). */
  private pending: Array<{ entry: IBlockchainBlock; fileHash: string; patientId: string }> = [];
  private batchTimer: NodeJS.Timeout | null = null;

  // ---------------------------------------------------------------- setup

  /** "contract" when a HealthRecords contract, an RPC URL and a relayer key are configured. */
  public get mode(): 'contract' | 'simulated' {
    return this.contractSettings() ? 'contract' : 'simulated';
  }

  private contractSettings(): { address: string; rpc: string; key: string } | null {
    if (config.blockchainMode === 'simulated') return null;
    const address = config.contractAddress;
    const rpc = config.chainRpcUrl;
    const key = config.chainPrivateKey;
    if (!ethers.isAddress(address) || !rpc || !/^(0x)?[0-9a-fA-F]{64}$/.test(key)) return null;
    // Hardhat's public test key is only acceptable on the local test chain
    if (key.replace(/^0x/, '').toLowerCase() === PUBLIC_TEST_KEY && config.walletChainId !== 31337) {
      if (!warnedTestKey) console.error('[Ledger] CHAIN_PRIVATE_KEY is Hardhat’s public test key; it is only used on the local chain (31337). Contract writes are off.');
      warnedTestKey = true;
      return null;
    }
    return { address: ethers.getAddress(address), rpc, key: key.startsWith('0x') ? key : `0x${key}` };
  }

  private getContract(): ethers.Contract | null {
    if (this.contract) return this.contract;
    const s = this.contractSettings();
    if (!s) return null;
    const provider = new ethers.JsonRpcProvider(s.rpc, this.chainId, { staticNetwork: true });
    const wallet = new ethers.Wallet(s.key, provider);
    this.contract = new ethers.Contract(s.address, CONTRACT_ABI, new ethers.NonceManager(wallet));
    return this.contract;
  }

  /** For tests: forget the connection so changed settings are picked up. */
  public reset(): void {
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = null;
    this.pending = [];
    this.contract = null;
    this.started = false;
    this.chainId = config.walletChainId;
  }

  public networkInfo() {
    const ex = EXPLORERS[this.chainId];
    return {
      mode: this.mode,
      chainId: this.chainId,
      network: ex?.name || `Chain ${this.chainId}`,
      contractAddress: this.mode === 'contract' ? ethers.getAddress(config.contractAddress) : null,
      explorerTxUrl: ex?.tx || null
    };
  }

  private explorerUrl(txHash?: string): string | undefined {
    const base = EXPLORERS[this.chainId]?.tx;
    return base && txHash ? `${base}${txHash}` : undefined;
  }

  // ---------------------------------------------------------------- the history

  private entries(): IBlockchainBlock[] {
    const s = stateStore.getState();
    if (!s.blocks) s.blocks = [];
    return s.blocks;
  }

  /**
   * Called once at start-up (and lazily before the first write). Starts the history if it is
   * empty, adds entries for reports and permissions that existed before the history was saved,
   * and in contract mode re-sends anything that had not reached the chain yet.
   */
  public init(): void {
    if (this.started) return;
    this.started = true;
    const list = this.entries();
    // entries from the old in-memory demo chain had made-up hashes; they are not kept
    if (list.length && !list.every((b) => b.currentHash === entryHash(b))) {
      console.warn('[Ledger] Stored history did not match its hashes; it was left as is. Check it on the admin Record history page.');
    }
    if (!list.length) this.append(ENTRY_TYPES.genesis, { note: 'MedLedger record history started on this server.' }, { chain: false });

    const known = new Set(list.filter((b) => b.type === ENTRY_TYPES.record).map((b) => String(b.payload?.fileHash || '').toLowerCase()));
    for (const r of stateStore.getState().reports || []) {
      const h = String(r.fileHash || '').toLowerCase();
      if (!/^0x[0-9a-f]{64}$/.test(h) || known.has(h)) continue;
      known.add(h);
      const entry = this.append(
        ENTRY_TYPES.record,
        { fileHash: h, patientId: String(r.patientId), reportId: r.reportId, uploadedAt: r.createdAt || null, addedLater: true },
        { chain: true }
      );
      this.enqueueRecord(entry, h, String(r.patientId));
    }

    const lastDecision = new Map<string, string>();
    for (const b of list) {
      if (b.type === ENTRY_TYPES.grant || b.type === ENTRY_TYPES.revoke) lastDecision.set(`${b.payload?.patientId}:${b.payload?.doctorId}`, b.type);
    }
    for (const c of stateStore.getState().consents || []) {
      const key = `${c.patientId}:${c.doctorId}`;
      if (c.status === 'granted' && lastDecision.get(key) !== ENTRY_TYPES.grant) {
        const entry = this.append(ENTRY_TYPES.grant, { patientId: c.patientId, doctorId: c.doctorId, decidedAt: c.decidedAt || null, addedLater: true }, { chain: true });
        this.enqueueConsent(entry, 'grant', c.patientId, c.doctorId);
      }
    }

    if (this.mode === 'contract') {
      for (const b of list) {
        if (b.chain?.status !== 'queued' && b.chain?.status !== 'sent') continue;
        if (b.chain.status === 'sent' && b.chain.txHash) this.trackReceipt([b], b.chain.txHash);
        else if (b.type === ENTRY_TYPES.record) this.enqueueRecord(b, String(b.payload?.fileHash), String(b.payload?.patientId));
        else if (b.type === ENTRY_TYPES.grant || b.type === ENTRY_TYPES.revoke) {
          this.enqueueConsent(b, b.type === ENTRY_TYPES.grant ? 'grant' : 'revoke', String(b.payload?.patientId), String(b.payload?.doctorId));
        }
      }
    }
    stateStore.saveState();
  }

  private append(type: string, payload: Record<string, unknown>, opts: { chain: boolean; receipt?: IChainReceipt }): IBlockchainBlock {
    const list = this.entries();
    const prev = list[list.length - 1];
    const entry: IBlockchainBlock = {
      blockNumber: list.length,
      type,
      timestamp: new Date().toISOString(),
      previousHash: prev ? prev.currentHash : ZERO,
      currentHash: '',
      payload
    };
    entry.currentHash = entryHash(entry);
    if (opts.receipt) entry.chain = opts.receipt;
    else if (opts.chain && this.mode === 'contract') entry.chain = { status: 'queued', network: this.networkInfo().network, chainId: this.chainId, by: 'relayer' };
    list.push(entry);
    return entry;
  }

  /** Recomputes every hash and link. */
  public verifyChain(): { intact: boolean; entries: number; firstBroken: number | null } {
    const list = this.entries();
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const prevOk = i === 0 ? b.previousHash === ZERO : b.previousHash === list[i - 1].currentHash;
      if (!prevOk || b.currentHash !== entryHash(b) || b.blockNumber !== i) return { intact: false, entries: list.length, firstBroken: i };
    }
    return { intact: true, entries: list.length, firstBroken: null };
  }

  // ---------------------------------------------------------------- addresses

  public deriveAddress(identifier: string): string {
    const hash = crypto.createHash('sha256').update(String(identifier)).digest('hex');
    return `0x${hash.substring(0, 40)}`;
  }

  public calculateSHA256(data: string | Buffer): string {
    return sha256(data);
  }

  /** A person's address on the chain: their linked MetaMask wallet, else a fixed address made from their account ID. */
  public addressOf(userId: string): string {
    const s = stateStore.getState();
    const u = (s.users || []).find((x) => String(x.userId) === String(userId));
    if (u?.walletAddress && ethers.isAddress(u.walletAddress)) return ethers.getAddress(u.walletAddress);
    const d = (s.doctors || []).find((x) => String(x.doctorId) === String(userId));
    if (d?.ethereumAddress && ethers.isAddress(d.ethereumAddress)) return ethers.getAddress(d.ethereumAddress);
    const p = (s.patients || []).find((x) => String(x.patientId) === String(userId));
    if (p?.ethereumAddress && ethers.isAddress(p.ethereumAddress)) return ethers.getAddress(p.ethereumAddress);
    return this.deriveAddress(userId);
  }

  // ---------------------------------------------------------------- writes

  public async registerRecord(fileHash: string, _patientAddress?: string | null, patientId?: string): Promise<{ txHash: string; blockNumber: number }> {
    this.init();
    const h = String(fileHash).toLowerCase();
    const entry = this.append(ENTRY_TYPES.record, { fileHash: h, patientId: String(patientId || 'unknown') }, { chain: true });
    stateStore.saveState();
    this.enqueueRecord(entry, h, String(patientId || 'unknown'));
    return { txHash: entry.currentHash, blockNumber: entry.blockNumber };
  }

  public async grantAccess(patientId: string, doctorId: string, evidence?: Evidence): Promise<string> {
    return this.consentEntry('grant', patientId, doctorId, evidence);
  }

  public async revokeAccess(patientId: string, doctorId: string, evidence?: Evidence): Promise<string> {
    return this.consentEntry('revoke', patientId, doctorId, evidence);
  }

  private consentEntry(action: 'grant' | 'revoke', patientId: string, doctorId: string, evidence?: Evidence): string {
    this.init();
    const payload = { patientId: String(patientId), doctorId: String(doctorId), confirmedWith: evidence?.method || 'session' };
    const byPatient = evidence?.method === 'onchain' && evidence.txHash;
    const entry = this.append(action === 'grant' ? ENTRY_TYPES.grant : ENTRY_TYPES.revoke, payload, {
      chain: !byPatient,
      receipt: byPatient
        ? {
            status: 'confirmed',
            network: this.networkInfo().network,
            chainId: this.chainId,
            by: 'patient-wallet',
            txHash: evidence!.txHash,
            blockNumber: evidence!.blockNumber,
            explorerUrl: this.explorerUrl(evidence!.txHash)
          }
        : undefined
    });
    stateStore.saveState();
    if (!byPatient) this.enqueueConsent(entry, action, String(patientId), String(doctorId));
    return entry.currentHash;
  }

  // ---------------------------------------------------------------- sending

  private enqueueRecord(entry: IBlockchainBlock, fileHash: string, patientId: string): void {
    if (config.chainBatchSize > 1) {
      if (!this.getContract() || !entry.chain) return;
      this.pending.push({ entry, fileHash, patientId });
      if (this.pending.length >= config.chainBatchSize) this.sendBatch();
      else if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.sendBatch(), config.chainBatchWaitMs);
        this.batchTimer.unref?.();
      }
      return;
    }
    this.enqueue({
      entry,
      send: async (c) => {
        if (await c.verifyRecord(fileHash)) return null; // already on the chain (same file uploaded before)
        return c.registerRecordFor(this.addressOf(patientId), fileHash);
      }
    });
  }

  private enqueueConsent(entry: IBlockchainBlock, action: 'grant' | 'revoke', patientId: string, doctorId: string): void {
    this.enqueue({
      entry,
      send: (c) => {
        const patient = this.addressOf(patientId);
        const doctor = this.addressOf(doctorId);
        return action === 'grant' ? c.grantAccessFor(patient, doctor) : c.revokeAccessFor(patient, doctor);
      }
    });
  }

  /** Anchors every waiting record under one Merkle root (batch mode). */
  private sendBatch(): void {
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = null;
    const items = this.pending.splice(0);
    const contract = this.getContract();
    if (!items.length || !contract) return;
    this.queue = this.queue.then(async () => {
      // the same file uploaded twice is one leaf; both entries share its proof
      const leaves: string[] = [];
      const index = new Map<string, number>();
      const placed = items.map((it) => {
        const patient = this.addressOf(it.patientId);
        const leaf = batchLeaf(patient, it.fileHash);
        if (!index.has(leaf)) {
          index.set(leaf, leaves.length);
          leaves.push(leaf);
        }
        return { ...it, patient, leafIndex: index.get(leaf)! };
      });
      const tree = merkleTree(leaves);
      for (const p of placed) (p.entry.chain as IChainReceipt).batch = { root: tree.root, proof: tree.proof(p.leafIndex), leafIndex: p.leafIndex, size: leaves.length, patient: p.patient };
      try {
        const tx: ethers.TransactionResponse = await contract.anchorBatch(tree.root, leaves.length);
        const sentAt = new Date().toISOString();
        for (const p of placed) Object.assign(p.entry.chain as IChainReceipt, { status: 'sent', txHash: tx.hash, sentAt, explorerUrl: this.explorerUrl(tx.hash) });
        this.trackReceipt(placed.map((p) => p.entry), tx.hash, tx);
      } catch (err) {
        for (const p of placed) Object.assign(p.entry.chain as IChainReceipt, { status: 'failed', error: shortError(err) });
        console.error(`[Ledger] A batch of ${placed.length} records could not be sent to the chain:`, shortError(err));
      }
      stateStore.saveState();
    });
  }

  private enqueue(job: Job): void {
    const contract = this.getContract();
    if (!contract || !job.entry.chain) return;
    this.queue = this.queue.then(async () => {
      const chain = job.entry.chain as IChainReceipt;
      try {
        const tx = await job.send(contract);
        if (!tx) {
          Object.assign(chain, { status: 'confirmed', note: 'Already on the chain' });
        } else {
          Object.assign(chain, { status: 'sent', txHash: tx.hash, sentAt: new Date().toISOString(), explorerUrl: this.explorerUrl(tx.hash) });
          this.trackReceipt([job.entry], tx.hash, tx);
        }
      } catch (err) {
        Object.assign(chain, { status: 'failed', error: shortError(err) });
        console.error(`[Ledger] Entry #${job.entry.blockNumber} could not be sent to the chain:`, shortError(err));
      }
      stateStore.saveState();
    });
  }

  private trackReceipt(entries: IBlockchainBlock[], txHash: string, tx?: ethers.TransactionResponse): void {
    const finish = (r: ethers.TransactionReceipt | null) => {
      if (!r) return;
      const confirmedAt = new Date().toISOString();
      for (const entry of entries) {
        Object.assign(entry.chain as IChainReceipt, r.status === 1 ? { status: 'confirmed', blockNumber: r.blockNumber, confirmedAt } : { status: 'failed', error: 'The transaction was reverted.' });
      }
      stateStore.saveState();
    };
    if (tx) {
      tx.wait(1)
        .then(finish)
        .catch((err) => {
          for (const entry of entries) Object.assign(entry.chain as IChainReceipt, { status: 'failed', error: shortError(err) });
          stateStore.saveState();
        });
      return;
    }
    // after a restart: look the transaction up until it is mined (up to 10 minutes)
    const provider = this.provider();
    if (!provider) return;
    const until = Date.now() + 10 * 60_000;
    const poll = async (): Promise<void> => {
      const r = await provider.getTransactionReceipt(txHash).catch(() => null);
      if (r) return finish(r);
      if (Date.now() < until) setTimeout(() => void poll(), 5000).unref?.();
    };
    void poll();
  }

  private provider(): ethers.Provider | null {
    const runner = this.getContract()?.runner as { provider?: ethers.Provider | null } | null | undefined;
    return runner?.provider ?? null;
  }

  /** Resolves when every queued transaction has been sent (tests and shutdown). */
  public async flush(): Promise<void> {
    if (this.pending.length) this.sendBatch();
    await this.queue;
  }

  /**
   * Asks the contract itself whether a fingerprint is anchored: directly (verifyRecord) or, for a record
   * sent in a batch, with its Merkle proof (verifyBatchedRecord). null when there is no contract.
   */
  public async verifyOnChain(fileHash: string): Promise<boolean | null> {
    const c = this.getContract();
    if (!c) return null;
    const h = String(fileHash).toLowerCase();
    const batch = this.findRecord(h)?.chain?.batch;
    if (batch) return Boolean(await c.verifyBatchedRecord(batch.patient, h, batch.root, batch.proof));
    return Boolean(await c.verifyRecord(h));
  }

  // ---------------------------------------------------------------- reads

  public async hasAccess(patientId: string, doctorId: string): Promise<boolean> {
    this.init();
    const last = [...this.entries()]
      .reverse()
      .find((b) => (b.type === ENTRY_TYPES.grant || b.type === ENTRY_TYPES.revoke) && String(b.payload?.patientId) === String(patientId) && String(b.payload?.doctorId) === String(doctorId));
    return last?.type === ENTRY_TYPES.grant;
  }

  private findRecord(fileHash: string): IBlockchainBlock | undefined {
    const trimmed = String(fileHash || '').trim().toLowerCase();
    const h = /^[0-9a-f]{64}$/.test(trimmed) ? `0x${trimmed}` : trimmed;
    return this.entries().find((b) => b.type === ENTRY_TYPES.record && String(b.payload?.fileHash).toLowerCase() === h);
  }

  public async verifyRecord(fileHash: string): Promise<boolean> {
    if (!fileHash) return false;
    this.init();
    return Boolean(this.findRecord(fileHash));
  }

  /** Where a fingerprint is recorded: in the local history, and (in contract mode) on the chain. */
  public recordStatus(fileHash: string) {
    this.init();
    const e = this.findRecord(fileHash);
    return {
      inHistory: Boolean(e),
      entry: e?.blockNumber ?? null,
      recordedAt: e?.timestamp ?? null,
      chain: e?.chain
        ? {
            status: e.chain.status,
            network: e.chain.network,
            txHash: e.chain.txHash || null,
            explorerUrl: e.chain.explorerUrl || null,
            // batch mode: what anyone needs to check this record on the chain (verifyBatchedRecord)
            ...(e.chain.batch ? { batch: { root: e.chain.batch.root, proof: e.chain.batch.proof, patient: e.chain.batch.patient, size: e.chain.batch.size } } : {})
          }
        : null
    };
  }

  public getBlocks(): IBlockchainBlock[] {
    this.init();
    return this.entries();
  }
}

function shortError(err: unknown): string {
  const e = err as { shortMessage?: string; reason?: string; message?: string };
  return String(e?.reason || e?.shortMessage || e?.message || err).slice(0, 200);
}

export const blockchainService = new BlockchainService();
