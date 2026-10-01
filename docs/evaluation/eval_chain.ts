/**
 * Phase 10 – time to confirmation, gas and fee for the server's chain writes, through the real app:
 * 50 uploads and 50 share / stop-sharing pairs, each queued by the server and followed to one confirmation.
 *
 *   Local chain (default): starts a Hardhat node with BLOCK_MS blocks (default 12000, like Sepolia), deploys the
 *   contract and runs against it.
 *   Sepolia: set CHAIN_RPC_URL, CHAIN_PRIVATE_KEY (the relayer that deployed the contract) and
 *   HEALTH_RECORDS_CONTRACT_ADDRESS, plus NETWORK=sepolia. Needs about 0.02 Sepolia ETH.
 *
 *   cd apps/server && node --import tsx ../../docs/evaluation/eval_chain.ts
 *   Options: UPLOADS=50 PAIRS=50 CHAIN_BATCH_SIZE=1 (e.g. 10 to anchor in batches) CHAIN_OUT=file.json
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import net from 'net';
import { spawn, execFileSync, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import type { AddressInfo } from 'net';
import { ethers } from 'ethers';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const HARDHAT = path.join(ROOT, 'node_modules', 'hardhat', 'internal', 'cli', 'cli.js');
const ARTIFACT = path.join(ROOT, 'blockchain', 'artifacts', 'blockchain', 'contracts', 'HealthRecords.sol', 'HealthRecords.json');
const NETWORK = process.env.NETWORK || 'local';
const UPLOADS = Number(process.env.UPLOADS || 50);
const PAIRS = Number(process.env.PAIRS || 50);
const BLOCK_MS = Number(process.env.BLOCK_MS || 12000);
const LOCAL_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-chain-eval-'));
Object.assign(process.env, {
  NODE_ENV: 'test', STATE_FILE_PATH: path.join(tmp, 'state.json'), FILE_STORAGE_DIR: path.join(tmp, 'files'),
  JWT_SECRET: 'evaluation-secret-that-is-definitely-longer-than-32-chars', AUTH_RATE_LIMIT: '100000', API_RATE_LIMIT: '10000000',
  DEMO_ACCOUNTS: 'true', OPENAI_API_KEY: '', OCR_ENABLED: 'false', LOG_LEVEL: 'silent', STATE_SAVE_DELAY_MS: '0'
});

type J = Record<string, any>;
let base = '';
const call = async (method: string, url: string, token?: string, body?: unknown) => {
  const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as J };
};
const freePort = () => new Promise<number>((r) => { const s = net.createServer(); s.listen(0, () => { const p = (s.address() as AddressInfo).port; s.close(() => r(p)); }); });
const pct = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : NaN; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let node: ChildProcess | null = null;
  let provider: ethers.JsonRpcProvider;
  if (NETWORK === 'local') {
    if (!fs.existsSync(ARTIFACT)) execFileSync(process.execPath, [HARDHAT, 'compile'], { cwd: ROOT, stdio: 'ignore' });
    const port = await freePort();
    node = spawn(process.execPath, [HARDHAT, 'node', '--port', String(port)], { cwd: ROOT, stdio: 'ignore' });
    const rpc = `http://127.0.0.1:${port}`;
    provider = new ethers.JsonRpcProvider(rpc, 31337, { staticNetwork: true });
    for (let i = 0; ; i++) { if (await provider.getBlockNumber().then(() => true).catch(() => false)) break; if (i > 300) throw new Error('node did not start'); await sleep(200); }
    const artifact = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8'));
    const deployed = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, new ethers.Wallet(LOCAL_KEY, provider)).deploy();
    await deployed.waitForDeployment();
    // from now on a block every BLOCK_MS, like a public network
    await provider.send('evm_setAutomine', [false]);
    await provider.send('evm_setIntervalMining', [BLOCK_MS]);
    Object.assign(process.env, { WALLET_CHAIN_ID: '31337', CHAIN_RPC_URL: rpc, CHAIN_PRIVATE_KEY: LOCAL_KEY, HEALTH_RECORDS_CONTRACT_ADDRESS: await deployed.getAddress() });
  } else {
    for (const k of ['CHAIN_RPC_URL', 'CHAIN_PRIVATE_KEY', 'HEALTH_RECORDS_CONTRACT_ADDRESS']) if (!process.env[k]) throw new Error(`Set ${k} for NETWORK=${NETWORK}`);
    process.env.WALLET_CHAIN_ID ||= '11155111';
    provider = new ethers.JsonRpcProvider(process.env.CHAIN_RPC_URL, Number(process.env.WALLET_CHAIN_ID), { staticNetwork: true });
  }

  const { createApp } = await import('../../apps/server/src/app.js');
  const { userStore } = await import('../../apps/server/src/services/userStore.js');
  const { blockchainService } = await import('../../apps/server/src/services/blockchainService.js');
  await userStore.seedDemoAccounts();
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (blockchainService.mode !== 'contract') throw new Error('The server is not in contract mode; check the chain settings.');
  const login = async (email: string, password: string) => (await call('POST', '/api/auth/login', undefined, { email, password })).body.data.token as string;
  const patient = await login('patient@medledger.demo', 'secret99');
  const doctor = await login('doctor@medledger.demo', 'secret99');
  const doctorId = String((await call('GET', '/api/auth/profile', doctor)).body.data.userId);
  const patientId = String((await call('GET', '/api/auth/profile', patient)).body.data.userId);
  blockchainService.getBlocks(); // start-up entries for the sample data are sent first and not measured
  await blockchainService.flush();
  const skip = new Set(blockchainService.getBlocks().map((b) => b.blockNumber));

  const t0 = Date.now();
  for (let i = 0; i < UPLOADS; i++) {
    const fd = new FormData();
    fd.append('clinicalNotes', `Chain evaluation report ${i} ${Date.now()}`);
    const r = await fetch(`${base}/api/records/upload`, { method: 'POST', headers: { Authorization: `Bearer ${patient}` }, body: fd });
    if (!r.ok) throw new Error(`upload ${i}: ${r.status}`);
  }
  for (let i = 0; i < PAIRS; i++) {
    await call('POST', '/api/access/request', doctor, { patientId });
    if ((await call('POST', '/api/access/grant', patient, { doctorId })).status !== 200) throw new Error(`grant ${i}`);
    if ((await call('POST', '/api/access/revoke', patient, { doctorId })).status !== 200) throw new Error(`revoke ${i}`);
  }
  console.error(`queued ${UPLOADS} uploads and ${PAIRS} pairs in ${((Date.now() - t0) / 1000).toFixed(1)} s; waiting for confirmations…`);
  await blockchainService.flush();

  const measured = () => blockchainService.getBlocks().filter((b) => !skip.has(b.blockNumber) && b.chain);
  const deadline = Date.now() + Number(process.env.WAIT_MS || (NETWORK === 'local' ? 5 * 60_000 : 30 * 60_000));
  while (Date.now() < deadline && measured().some((b) => b.chain!.status === 'queued' || b.chain!.status === 'sent')) await sleep(1000);

  const entries = measured();
  const receipts = new Map<string, ethers.TransactionReceipt | null>();
  for (const e of entries) if (e.chain!.txHash && !receipts.has(e.chain!.txHash)) receipts.set(e.chain!.txHash, await provider.getTransactionReceipt(e.chain!.txHash));
  const kinds: Record<string, string> = { 'Report fingerprint saved': 'upload', 'Shared with doctor': 'grant', 'Stopped sharing with doctor': 'revoke' };
  const summary: J = {};
  for (const kind of ['upload', 'grant', 'revoke']) {
    const es = entries.filter((e) => kinds[e.type] === kind);
    const done = es.filter((e) => e.chain!.status === 'confirmed' && e.chain!.confirmedAt);
    const fromQueue = done.map((e) => (Date.parse(e.chain!.confirmedAt!) - Date.parse(e.timestamp)) / 1000);
    const fromSend = done.filter((e) => e.chain!.sentAt).map((e) => (Date.parse(e.chain!.confirmedAt!) - Date.parse(e.chain!.sentAt!)) / 1000);
    const txs = [...new Set(done.map((e) => e.chain!.txHash!))].map((h) => receipts.get(h)).filter(Boolean) as ethers.TransactionReceipt[];
    const gasPerEntry = txs.reduce((a, r) => a + Number(r.gasUsed), 0) / Math.max(1, done.length);
    const feeWei = txs.reduce((a, r) => a + r.gasUsed * (r.gasPrice ?? 0n), 0n);
    summary[kind] = {
      queued: es.length, confirmed: done.length, failed: es.filter((e) => e.chain!.status === 'failed').length, confirmedRate: done.length / Math.max(1, es.length),
      transactions: txs.length,
      secondsQueueToConfirm: { median: pct(fromQueue, 0.5), p95: pct(fromQueue, 0.95), max: Math.max(...fromQueue) },
      secondsSendToConfirm: { median: pct(fromSend, 0.5), p95: pct(fromSend, 0.95) },
      gasPerEntry: Math.round(gasPerEntry),
      feeEthPerEntry: Number(ethers.formatEther(feeWei)) / Math.max(1, done.length),
      errors: [...new Set(es.filter((e) => e.chain!.error).map((e) => e.chain!.error))].slice(0, 3)
    };
  }
  const all = entries.length, confirmed = entries.filter((e) => e.chain!.status === 'confirmed').length;
  const result = {
    network: NETWORK, chainId: Number(process.env.WALLET_CHAIN_ID), blockMs: NETWORK === 'local' ? BLOCK_MS : null,
    batchSize: Number(process.env.CHAIN_BATCH_SIZE || 1), uploads: UPLOADS, pairs: PAIRS,
    queuedWrites: all, confirmedWrites: confirmed, confirmedRate: confirmed / Math.max(1, all), byKind: summary, measuredAt: new Date().toISOString()
  };
  const out = path.resolve(here, 'results', process.env.CHAIN_OUT || `chain_eval_${NETWORK}${result.batchSize > 1 ? `_batch${result.batchSize}` : ''}.json`);
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result, null, 1));
  server.close();
  node?.kill();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
