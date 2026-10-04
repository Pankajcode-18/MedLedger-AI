/**
 * Phase 5 – the server writes to a real HealthRecords contract.
 * Starts a local Hardhat node, deploys the contract, points the server at it, then checks that an
 * upload, a share and a stop-sharing each become a confirmed transaction with the right event.
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medledger-chain-'));
process.env.NODE_ENV = 'test';
process.env.STATE_FILE_PATH = path.join(tmpDir, 'state.json');
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';
process.env.AUTH_RATE_LIMIT = '10000';
process.env.DEMO_ACCOUNTS = 'true';
process.env.OPENAI_API_KEY = '';

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

describe('writing to the HealthRecords contract', { skip: !available && 'root dev dependencies (hardhat) are not installed' }, () => {
  test('the server is in contract mode', async () => {
    const s = await call('GET', '/api/blockchain/status', t.admin);
    assert.equal(s.body.data.mode, 'contract');
    assert.equal(s.body.data.chainId, 31337);
    assert.equal(s.body.data.contractAddress, await contract.getAddress());
  });

  test('an upload is registered on the chain for the patient', async () => {
    const { blockchainService } = await import('../src/services/blockchainService.js');
    const form = new FormData();
    form.append('clinicalNotes', 'Fasting sugar 98 mg/dL');
    form.append('reportTitle', 'Sugar test');
    const up = (await (await fetch(`${base}/api/records/upload`, { method: 'POST', headers: { Authorization: `Bearer ${t.patient}` }, body: form })).json()) as Json;
    assert.equal(up.success, true);
    await blockchainService.flush();
    const fileHash = (await call('GET', `/api/records/${up.data.reportId}/verify`, t.patient)).body.data.fileHash;
    assert.equal(await contract.verifyRecord(fileHash), true);
    const [owner] = await contract.getRecordDetails(fileHash);
    assert.equal(owner, blockchainService.addressOf('90'));
    const entry = await waitFor(() => blockchainService.getBlocks().find((b) => b.payload?.fileHash === fileHash && b.chain?.status === 'confirmed'));
    assert.match(String(entry.chain?.txHash), /^0x[0-9a-f]{64}$/);
    assert.ok(Number(entry.chain?.blockNumber) > 0);
    assert.equal(entry.chain?.by, 'relayer');
    // Phase 10: one storage slot instead of an array + three mappings
    const receipt = await contract.runner!.provider!.getTransactionReceipt(String(entry.chain?.txHash));
    assert.ok(receipt && receipt.gasUsed <= 60000n, `gas ${receipt?.gasUsed}`);
    assert.ok(entry.chain?.sentAt && entry.chain?.confirmedAt, 'send and confirmation times are kept');
    assert.equal(await blockchainService.verifyOnChain(fileHash), true);
  });

  test('sharing and stopping sharing emit AccessGranted and AccessRevoked for the right people', async () => {
    const { blockchainService } = await import('../src/services/blockchainService.js');
    const patientAddr = blockchainService.addressOf('90');
    const doctorAddr = blockchainService.addressOf('1593418229676');
    assert.equal((await call('POST', '/api/access/grant', t.patient, { doctorId: '1593418229676' })).status, 200);
    await blockchainService.flush();
    await waitFor(async () => contract.hasAccess(patientAddr, doctorAddr));
    assert.equal((await call('POST', '/api/access/revoke', t.patient, { doctorId: '1593418229676' })).status, 200);
    await blockchainService.flush();
    await waitFor(async () => !(await contract.hasAccess(patientAddr, doctorAddr)));

    const granted = await contract.queryFilter(contract.filters.AccessGranted(patientAddr, doctorAddr));
    const revoked = await contract.queryFilter(contract.filters.AccessRevoked(patientAddr, doctorAddr));
    assert.ok(granted.length >= 1);
    assert.ok(revoked.length >= 1);

    const list = (await call('GET', '/api/blockchain/blocks', t.admin)).body as Json[];
    const last = list.filter((b) => b.type === 'Stopped sharing with doctor').pop();
    await waitFor(() => blockchainService.getBlocks()[last.blockNumber].chain?.status === 'confirmed');
    assert.equal(blockchainService.getBlocks()[last.blockNumber].chain?.txHash, revoked[revoked.length - 1].transactionHash);
  });

  test('uploading the same file twice does not fail on the chain', async () => {
    const { blockchainService } = await import('../src/services/blockchainService.js');
    const send = async () => {
      const form = new FormData();
      form.append('clinicalNotes', 'Same note twice');
      await fetch(`${base}/api/records/upload`, { method: 'POST', headers: { Authorization: `Bearer ${t.patient}` }, body: form });
    };
    await send();
    await send();
    await blockchainService.flush();
    const entries = blockchainService.getBlocks().slice(-2);
    await waitFor(() => entries.every((e) => e.chain?.status === 'confirmed'));
    assert.ok(entries.some((e) => e.chain?.note === 'Already on the chain'));
  });
});
