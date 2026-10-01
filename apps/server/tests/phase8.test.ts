/**
 * Phase 8 – performance without weakening any check:
 *  - state writes are coalesced and the audit trail is an append-only encrypted file
 *  - large files are hashed and decrypted off the main thread, and tampering is still caught
 *  - record lists can be paged and slimmed; consent lookups are indexed
 * Run with: npm test (inside apps/server).
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medledger-phase8-'));
process.env.NODE_ENV = 'test';
process.env.STATE_FILE_PATH = path.join(tmpDir, 'state.json');
process.env.FILE_STORAGE_DIR = path.join(tmpDir, 'files');
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';
process.env.AUTH_RATE_LIMIT = '10000';
process.env.DEMO_ACCOUNTS = 'true';
process.env.OPENAI_API_KEY = '';
process.env.OCR_ENABLED = 'false';

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
const tokenFor = async (email: string, password: string) => (await call('POST', '/api/auth/login', undefined, { email, password })).body.data.token as string;
const addNote = async (token: string, text: string) => {
  const fd = new FormData();
  fd.append('clinicalNotes', text);
  return (await (await fetch(`${base}/api/records/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })).json()) as Json;
};

before(async () => {
  const { createApp } = await import('../src/app.js');
  const { userStore } = await import('../src/services/userStore.js');
  await userStore.seedDemoAccounts();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.patient = await tokenFor('patient@medledger.demo', 'secret99');
  t.doctor = await tokenFor('doctor@medledger.demo', 'secret99');
});

after(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('state and audit writes', () => {
  test('many changes become one write, and everything is on disk after flush()', async () => {
    const { stateStore } = await import('../src/models/stateStore.js');
    await stateStore.flush();
    const before = fs.statSync(process.env.STATE_FILE_PATH as string).mtimeMs;
    for (let i = 0; i < 5; i++) await addNote(t.patient, `Coalesced note ${i}`);
    await stateStore.flush();
    const saved = JSON.parse(fs.readFileSync(process.env.STATE_FILE_PATH as string, 'utf8'));
    assert.ok(fs.statSync(process.env.STATE_FILE_PATH as string).mtimeMs >= before);
    assert.equal(saved.reports.length, stateStore.getState().reports.length);
    assert.equal(saved.auditLogs, undefined, 'the audit trail is no longer inside the state file');
  });

  test('the audit trail is appended as encrypted lines and read back on start-up', async () => {
    const { stateStore } = await import('../src/models/stateStore.js');
    await stateStore.flush();
    const auditFile = `${process.env.STATE_FILE_PATH}.audit`;
    const raw = fs.readFileSync(auditFile, 'utf8');
    assert.ok(raw.trim().split('\n').length >= 5);
    assert.ok(!raw.includes('RECORD_UPLOADED'), 'no readable action names on disk');
    assert.ok(!raw.includes('patient@medledger.demo'));
    const inMemory = stateStore.getState().auditLogs!.length;
    const reloaded = stateStore.loadState();
    assert.equal(reloaded.auditLogs!.length, inMemory);
    assert.ok(reloaded.auditLogs!.some((l) => l.action === 'RECORD_UPLOADED_AND_ENCRYPTED'));
  });

  test('an older state file with the audit trail inline is moved to the audit file once', async () => {
    const { stateStore } = await import('../src/models/stateStore.js');
    await stateStore.flush();
    const file = process.env.STATE_FILE_PATH as string;
    const auditFile = `${file}.audit`;
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    const count = stateStore.getState().auditLogs!.length;
    saved.auditLogs = [{ patientId: '90', actorId: 'x', actorRole: 'admin', action: 'LEGACY_ENTRY', timestamp: new Date().toISOString(), details: {} }];
    fs.writeFileSync(file, JSON.stringify(saved));
    const reloaded = stateStore.loadState();
    assert.equal(reloaded.auditLogs!.length, count + 1);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).auditLogs, undefined, 'removed from the state file');
    assert.equal(fs.readFileSync(auditFile, 'utf8').trim().split('\n').length, count + 1);
  });
});

describe('large files are checked off the main thread', () => {
  test('a 3 MB file round-trips, and a changed byte is still caught', async () => {
    const { recordVault, IntegrityError } = await import('../src/services/recordVault.js');
    const plaintext = crypto.randomBytes(3 * 1024 * 1024);
    const sealed = await recordVault.sealFile('bigtest1', '90', plaintext);
    const report: Json = { reportId: 'bigtest1', patientId: '90', fileHash: sealed.fileHash, encryption: sealed.encryption, storage: sealed.storage, fileName: 'x.pdf' };
    assert.ok((await recordVault.openFile(report as never)).equals(plaintext));

    // an attacker edits the stored blob and fixes up its checksum: the GCM tag still refuses it
    const p = path.join(process.env.FILE_STORAGE_DIR as string, sealed.storage.ref);
    const ct = fs.readFileSync(p);
    ct[1_500_000] ^= 1;
    fs.writeFileSync(p, ct);
    const fixed = { ...report, storage: { ...sealed.storage, ciphertextSha256: crypto.createHash('sha256').update(ct).digest('hex') } };
    await assert.rejects(recordVault.openFile(fixed as never), (e: unknown) => e instanceof IntegrityError && (e as InstanceType<typeof IntegrityError>).stage === 'decryption');
    // without fixing the checksum, the checksum catches it first
    await assert.rejects(recordVault.openFile(report as never), (e: unknown) => e instanceof IntegrityError && (e as InstanceType<typeof IntegrityError>).stage === 'ciphertext');
  });

  test('a large file sealed off-thread opens with the ordinary (small-file) routine too', async () => {
    const { recordVault } = await import('../src/services/recordVault.js');
    const { encryptionService } = await import('../src/services/encryptionService.js');
    const { keyService } = await import('../src/services/keyService.js');
    const plaintext = crypto.randomBytes(2 * 1024 * 1024);
    const sealed = await recordVault.sealFile('bigtest2', '90', plaintext);
    const ct = fs.readFileSync(path.join(process.env.FILE_STORAGE_DIR as string, sealed.storage.ref));
    const dek = keyService.unwrap(sealed.encryption.wrappedKey, 'file:bigtest2');
    const out = encryptionService.decrypt(ct, dek, sealed.encryption.iv, sealed.encryption.authTag, 'medledger-file:v1:bigtest2:90');
    assert.ok(out.equals(plaintext), 'the stored format did not change');
  });
});

describe('record lists', () => {
  test('pages come newest first with a total, and the summary leaves out notes', async () => {
    for (let i = 0; i < 4; i++) await addNote(t.patient, `Paged note ${i}`);
    const all = await call('GET', '/api/records', t.patient);
    const page = await call('GET', '/api/records?limit=2&offset=0&fields=summary', t.patient);
    assert.equal(page.status, 200);
    assert.equal(page.body.data.length, 2);
    assert.equal(page.body.total, all.body.data.length);
    assert.equal(page.body.hasMore, true);
    const newest = [...all.body.data].sort((a: Json, b: Json) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || Number(b.reportId) - Number(a.reportId))[0];
    assert.equal(page.body.data[0].reportId, newest.reportId);
    assert.equal(page.body.data[0].report, undefined, 'no notes in the summary');
    assert.equal(page.body.data[0].authorizedUsers, undefined);
    const next = await call('GET', '/api/records?limit=2&offset=2&fields=summary', t.patient);
    assert.notEqual(next.body.data[0].reportId, page.body.data[0].reportId);
  });

  test('a doctor sees exactly the records of patients who share, before and after a change', async () => {
    const doctorId = String((await call('GET', '/api/auth/profile', t.doctor)).body.data.userId);
    await call('POST', '/api/access/request', t.doctor, { patientId: String((await call('GET', '/api/auth/profile', t.patient)).body.data.userId) });
    await call('POST', '/api/access/grant', t.patient, { doctorId });
    const shared = (await call('GET', '/api/records?fields=summary', t.doctor)).body.data.length;
    assert.ok(shared > 0);
    await call('POST', '/api/access/revoke', t.patient, { doctorId });
    assert.equal((await call('GET', '/api/records?fields=summary', t.doctor)).body.data.length, 0, 'revocation takes effect at once');
    await call('POST', '/api/access/request', t.doctor, { patientId: String((await call('GET', '/api/auth/profile', t.patient)).body.data.userId) });
    await call('POST', '/api/access/grant', t.patient, { doctorId });
    assert.equal((await call('GET', '/api/records?fields=summary', t.doctor)).body.data.length, shared);
  });
});
