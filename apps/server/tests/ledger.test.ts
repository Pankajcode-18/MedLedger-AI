/**
 * Phase 5 – the record history is saved, hash-linked, backfilled for older data and readable by admins only.
 * Runs without any blockchain (simulated mode). tests/chain.test.ts covers the real contract.
 * Run with: npm test (inside apps/server).
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medledger-ledger-'));
const STATE = path.join(tmpDir, 'state.json');
process.env.NODE_ENV = 'test';
process.env.STATE_FILE_PATH = STATE;
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';
process.env.AUTH_RATE_LIMIT = '10000';
process.env.DEMO_ACCOUNTS = 'true';
process.env.OPENAI_API_KEY = '';
process.env.BLOCKCHAIN_MODE = 'simulated';

type Json = Record<string, any>;
let server: Server;
let base = '';
const t: Record<string, string> = {};

const call = async (method: string, url: string, token?: string, body?: unknown) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};
const login = async (email: string, password: string) => (await call('POST', '/api/auth/login', undefined, { email, password })).body.data.token as string;
const upload = async (token: string, notes: string) => {
  const form = new FormData();
  form.append('clinicalNotes', notes);
  form.append('reportTitle', 'Blood test');
  const res = await fetch(`${base}/api/records/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return (await res.json()) as Json;
};

before(async () => {
  // an older install: a report and a permission that were saved before the history was kept
  fs.writeFileSync(
    STATE,
    JSON.stringify({
      patients: [],
      doctors: [],
      reports: [{ reportId: '1000000000009', patientId: '90', fileName: 'old.txt', fileHash: `0x${'ab'.repeat(32)}`, createdAt: '2026-01-02T03:04:05.000Z' }],
      blocks: [],
      users: []
    })
  );
  const { stateStore } = await import('../src/models/stateStore.js');
  stateStore.getState().consents = [{ patientId: '90', doctorId: '1593418229676', status: 'granted', updatedAt: '2026-01-03T00:00:00.000Z' } as never];
  const { createApp } = await import('../src/app.js');
  const { userStore } = await import('../src/services/userStore.js');
  await userStore.seedDemoAccounts();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.patient = await login('patient@medledger.demo', 'secret99');
  t.admin = await login('admin@medledger.demo', 'admin123');
});

after(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('record history', () => {
  test('starts with a first entry and adds entries for older reports and permissions', async () => {
    const { blockchainService, ENTRY_TYPES } = await import('../src/services/blockchainService.js');
    const list = blockchainService.getBlocks();
    assert.equal(list[0].type, ENTRY_TYPES.genesis);
    const old = list.find((b) => b.payload?.reportId === '1000000000009');
    assert.ok(old, 'older report has an entry');
    assert.equal(old!.payload?.addedLater, true);
    assert.equal(old!.payload?.uploadedAt, '2026-01-02T03:04:05.000Z');
    assert.ok(list.some((b) => b.type === ENTRY_TYPES.grant && b.payload?.doctorId === '1593418229676' && b.payload?.addedLater));
    assert.equal(blockchainService.mode, 'simulated');
    assert.ok(list.every((b) => !b.chain), 'nothing is sent anywhere without a contract');
  });

  test('uploads and sharing decisions are added, linked and saved to disk', async () => {
    const before = (await call('GET', '/api/blockchain/blocks', t.admin)).body.length;
    const up = await upload(t.patient, 'Hb 13.8 g/dL');
    await call('POST', '/api/access/revoke', t.patient, { doctorId: '1593418229676' });
    await call('POST', '/api/access/grant', t.patient, { doctorId: '1593418229676' });
    const list = (await call('GET', '/api/blockchain/blocks', t.admin)).body as Json[];
    assert.equal(list.length, before + 3);
    const [rec, rev, gr] = list.slice(-3);
    assert.equal(rec.type, 'Report fingerprint saved');
    assert.equal(rec.payload.patientId, '90');
    assert.equal(rev.type, 'Stopped sharing with doctor');
    assert.equal(gr.type, 'Shared with doctor');
    for (let i = 1; i < list.length; i++) assert.equal(list[i].previousHash, list[i - 1].currentHash);

    await (await import('../src/models/stateStore.js')).stateStore.flush(); // writes are coalesced
    const saved = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    assert.equal(saved.blocks.length, list.length, 'history is in state.json');
    // the record check sees the new fingerprint
    const v = await call('GET', `/api/records/${up.data.reportId}/verify`, t.patient);
    assert.equal(v.body.data.blockchainAnchored, true);
    assert.equal(v.body.data.history.inHistory, true);
    assert.equal(v.body.data.history.entry, rec.blockNumber);
  });

  test('the history is checked link by link, and an edited entry is caught', async () => {
    const { blockchainService } = await import('../src/services/blockchainService.js');
    assert.equal(blockchainService.verifyChain().intact, true);
    const list = blockchainService.getBlocks();
    const victim = list[2];
    const original = victim.payload?.patientId;
    victim.payload = { ...victim.payload, patientId: '999' };
    const broken = blockchainService.verifyChain();
    assert.equal(broken.intact, false);
    assert.equal(broken.firstBroken, 2);
    victim.payload = { ...victim.payload, patientId: original };
    assert.equal(blockchainService.verifyChain().intact, true);
  });

  test('status endpoint reports the mode and link check', async () => {
    const s = await call('GET', '/api/blockchain/status', t.admin);
    assert.equal(s.status, 200);
    assert.equal(s.body.data.mode, 'simulated');
    assert.equal(s.body.data.intact, true);
    assert.equal(s.body.data.contractAddress, null);
  });

  test('only administrators can read the full history', async () => {
    assert.equal((await call('GET', '/api/blockchain/blocks')).status, 401);
    assert.equal((await call('GET', '/api/blockchain/blocks', t.patient)).status, 403);
    assert.equal((await call('GET', '/getBlocks', t.patient)).status, 403);
    assert.equal((await call('GET', '/api/blockchain/status', t.patient)).status, 403);
    // anyone may still check a single fingerprint
    const list = (await call('GET', '/api/blockchain/blocks', t.admin)).body as Json[];
    const rec = list.find((b) => b.type === 'Report fingerprint saved');
    const v = await call('POST', '/api/blockchain/verify', undefined, { fileHash: rec.payload.fileHash });
    assert.equal(v.status, 200);
    assert.equal(v.body.verified, true);
    assert.equal(v.body.historyEntry, rec.blockNumber);
  });
});
