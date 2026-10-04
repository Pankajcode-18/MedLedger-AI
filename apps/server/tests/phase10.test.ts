/**
 * Phase 10 – uploads anchored in batches: one Merkle root per transaction, each record checkable alone.
 * Starts a local Hardhat node and deploys the contract, with CHAIN_BATCH_SIZE=3.
 * Needs the root project's dev dependencies (npm install in the repository root); skipped otherwise.
 * Run with: npm test (inside apps/server).
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import net from 'net';
import { spawn, execFileSync, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { ethers } from 'ethers';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../../..');
const HARDHAT = path.join(ROOT, 'node_modules', 'hardhat', 'internal', 'cli', 'cli.js');
const ARTIFACT = path.join(ROOT, 'blockchain', 'artifacts', 'blockchain', 'contracts', 'HealthRecords.sol', 'HealthRecords.json');
const available = fs.existsSync(HARDHAT);

// Hardhat's first default account (public test key, holds only local test ETH)
const RELAYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medledger-phase10-'));
process.env.NODE_ENV = 'test';
process.env.STATE_FILE_PATH = path.join(tmpDir, 'state.json');
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';
process.env.AUTH_RATE_LIMIT = '10000';
process.env.DEMO_ACCOUNTS = 'true';
process.env.OPENAI_API_KEY = '';
process.env.OCR_ENABLED = 'false';
process.env.CHAIN_BATCH_SIZE = '3';
process.env.CHAIN_BATCH_WAIT_MS = '2000';

type Json = Record<string, any>;
let node: ChildProcess | null = null;
let server: Server;
let base = '';
let contract: ethers.Contract;
const t: Record<string, string> = {};

const freePort = () =>
  new Promise<number>((resolve) => {
    const s = net.createServer();
    s.listen(0, () => {
      const p = (s.address() as AddressInfo).port;
      s.close(() => resolve(p));
    });
  });

const call = async (method: string, url: string, token?: string, body?: unknown) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};

async function waitFor<T>(fn: () => T | Promise<T>, ms = 20000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 200));
  }
}

before(async () => {
  if (!available) return;
  // always compile (a no-op when up to date) so a stale saved build never gets deployed
  execFileSync(process.execPath, [HARDHAT, 'compile'], { cwd: ROOT, stdio: 'ignore' });
  const port = await freePort();
  node = spawn(process.execPath, [HARDHAT, 'node', '--port', String(port)], { cwd: ROOT, stdio: 'ignore' });
  const rpc = `http://127.0.0.1:${port}`;
  const provider = new ethers.JsonRpcProvider(rpc, 31337, { staticNetwork: true });
  await waitFor(async () => provider.getBlockNumber().then(() => true).catch(() => false), 60000);

  const artifact = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8'));
  const deployer = new ethers.Wallet(RELAYER_KEY, provider);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  const deployed = await factory.deploy();
  await deployed.waitForDeployment();
  contract = new ethers.Contract(await deployed.getAddress(), artifact.abi, provider);

  process.env.WALLET_CHAIN_ID = '31337';
  process.env.CHAIN_RPC_URL = rpc;
  process.env.CHAIN_PRIVATE_KEY = RELAYER_KEY;
  process.env.HEALTH_RECORDS_CONTRACT_ADDRESS = await deployed.getAddress();

  const { createApp } = await import('../src/app.js');
  const { userStore } = await import('../src/services/userStore.js');
  await userStore.seedDemoAccounts();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.patient = (await call('POST', '/api/auth/login', undefined, { email: 'patient@medledger.demo', password: 'secret99' })).body.data.token;
  t.admin = (await call('POST', '/api/auth/login', undefined, { email: 'admin@medledger.demo', password: 'admin123' })).body.data.token;
});

after(() => {
  server?.close();
  node?.kill();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const upload = async (note: string) => {
  const form = new FormData();
  form.append('clinicalNotes', note);
  const up = (await (await fetch(`${base}/api/records/upload`, { method: 'POST', headers: { Authorization: `Bearer ${t.patient}` }, body: form })).json()) as Json;
  return String((await call('GET', `/api/records/${up.data.reportId}/verify`, t.patient)).body.data.fileHash);
};

describe('records anchored in batches', { skip: !available && 'root dev dependencies (hardhat) are not installed' }, () => {
  test('three uploads become one anchorBatch transaction, and each record is verified alone', async () => {
    const { blockchainService } = await import('../src/services/blockchainService.js');
    blockchainService.getBlocks(); // start-up adds entries for the sample reports; send those first
    await blockchainService.flush();
    const hashes = [await upload('Batch note A'), await upload('Batch note B'), await upload('Batch note C')];
    const entries = await waitFor(() => {
      const es = hashes.map((h) => blockchainService.getBlocks().find((b) => b.payload?.fileHash === h));
      return es.every((e) => e?.chain?.status === 'confirmed') ? es : null;
    });
    const tx = entries[0]!.chain!.txHash;
    assert.ok(entries.every((e) => e!.chain!.txHash === tx), 'one transaction for the three');
    const root = entries[0]!.chain!.batch!.root;
    const anchored = await contract.queryFilter(contract.filters.BatchAnchored(root));
    assert.equal(anchored.length, 1);
    assert.equal((anchored[0] as ethers.EventLog).args.count, 3n);
    for (const [i, h] of hashes.entries()) {
      const b = entries[i]!.chain!.batch!;
      assert.equal(await contract.verifyBatchedRecord(b.patient, h, b.root, b.proof), true);
      assert.equal(await blockchainService.verifyOnChain(h), true);
    }
    // a changed file does not match any proof
    const b0 = entries[0]!.chain!.batch!;
    assert.equal(await contract.verifyBatchedRecord(b0.patient, `0x${'ab'.repeat(32)}`, b0.root, b0.proof), false);
    // the verify page shows what anyone needs to check it on the chain
    const status = blockchainService.recordStatus(hashes[1]);
    assert.equal(status.chain?.batch?.root, root);
    const receipt = await contract.runner!.provider!.getTransactionReceipt(String(tx));
    assert.ok(receipt && receipt.gasUsed / 3n <= 20000n, `gas ${receipt?.gasUsed}`);
  });

  test('a batch that does not fill up is sent after the waiting time', async () => {
    const { blockchainService } = await import('../src/services/blockchainService.js');
    const h = await upload('Lonely batch note');
    const e = await waitFor(() => {
      const x = blockchainService.getBlocks().find((b) => b.payload?.fileHash === h);
      return x?.chain?.status === 'confirmed' ? x : null;
    });
    assert.equal(e.chain?.batch?.size, 1);
    assert.deepEqual(e.chain?.batch?.proof, []);
    assert.equal(await blockchainService.verifyOnChain(h), true);
  });

  test('sharing is still one transaction each, not batched', async () => {
    const { blockchainService } = await import('../src/services/blockchainService.js');
    assert.equal((await call('POST', '/api/access/grant', t.patient, { doctorId: '1593418229676' })).status, 200);
    await blockchainService.flush();
    await waitFor(async () => contract.hasAccess(blockchainService.addressOf('90'), blockchainService.addressOf('1593418229676')));
  });
});
