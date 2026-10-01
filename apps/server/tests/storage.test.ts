/**
 * Encrypted storage tests (Project Guide §5 "Security Design", §11 testing).
 * Upload → AES-256-GCM → stored ciphertext → download of the identical original,
 * tamper detection, permissions, notes encrypted at rest, legacy migration and key rotation.
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medledger-storage-'));
process.env.NODE_ENV = 'test';
process.env.STATE_FILE_PATH = path.join(tmpDir, 'state.json');
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';
process.env.AUTH_RATE_LIMIT = '10000';
process.env.AI_RATE_LIMIT_PER_MIN = '10000';
process.env.DEMO_ACCOUNTS = 'true';
process.env.UPLOAD_MAX_MB = '1';
process.env.OPENAI_API_KEY = '';

type Json = Record<string, any>;
let server: Server;
let base = '';
const STORE_DIR = path.join(tmpDir, 'encrypted-files');

const tokenFor = async (email: string, password: string): Promise<string> => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return ((await res.json()) as Json).data.token;
};

const upload = async (token: string, fields: Record<string, string>, file?: { name: string; bytes: Buffer; type?: string }) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (file) form.append('file', new Blob([file.bytes], { type: file.type || 'application/octet-stream' }), file.name);
  const res = await fetch(`${base}/api/records/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};

const get = async (url: string, token?: string) => {
  const res = await fetch(base + url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const buf = Buffer.from(await res.arrayBuffer());
  let json: Json = {};
  try {
    json = JSON.parse(buf.toString('utf8'));
  } catch {
    /* binary */
  }
  return { status: res.status, headers: res.headers, buf, json };
};

// A small but real PDF with a binary section and a recognisable marker in the content stream
const MARKER = 'CONFIDENTIAL-HB-9.1-MARKER';
const PDF = Buffer.concat([
  Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj << /Type /Catalog >> endobj\nstream\n', 'latin1'),
  Buffer.from(`BT (${MARKER}) Tj ET\n`),
  crypto.randomBytes(2048),
  Buffer.from('\nendstream\n%%EOF\n')
]);

let patient = '';
let doctor = '';
let lab = '';
let admin = '';

before(async () => {
  const { createApp } = await import('../src/app.js');
  const { userStore } = await import('../src/services/userStore.js');
  await userStore.seedDemoAccounts();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  patient = await tokenFor('patient@medledger.demo', 'secret99');
  doctor = await tokenFor('doctor@medledger.demo', 'secret99');
  lab = await tokenFor('lab@medledger.demo', 'lab123');
  admin = await tokenFor('admin@medledger.demo', 'admin123');
});

after(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('encrypted upload and download', () => {
  let reportId = '';

  test('a PDF is encrypted, stored and returned byte-for-byte', async () => {
    const up = await upload(patient, { clinicalNotes: 'Hemoglobin 9.1 g/dL (LOW)', reportTitle: 'CBC' }, { name: 'cbc report.pdf', bytes: PDF, type: 'application/pdf' });
    assert.equal(up.status, 201, JSON.stringify(up.body));
    assert.equal(up.body.data.encrypted, true);
    assert.equal(up.body.data.storageBackend, 'local');
    assert.equal(up.body.data.fileType, 'application/pdf');
    assert.equal(up.body.data.fileHash, `0x${crypto.createHash('sha256').update(PDF).digest('hex')}`);
    reportId = up.body.data.reportId;

    // only ciphertext on disk
    const stored = fs.readFileSync(path.join(STORE_DIR, `${reportId}.enc`));
    assert.equal(stored.length, PDF.length, 'GCM ciphertext has the same length as the input');
    assert.ok(!stored.includes(Buffer.from(MARKER)), 'plaintext must not be stored');
    assert.ok(!stored.subarray(0, 5).equals(Buffer.from('%PDF-')));

    const dl = await get(`/api/records/${reportId}/download`, patient);
    assert.equal(dl.status, 200);
    assert.ok(dl.buf.equals(PDF), 'downloaded file must be identical to the upload');
    assert.equal(dl.headers.get('content-type'), 'application/pdf');
    assert.match(dl.headers.get('content-disposition') || '', /filename="cbc report\.pdf"/);
    assert.equal(dl.headers.get('x-integrity-verified'), 'true');
    assert.equal(dl.headers.get('cache-control'), 'no-store');
  });

  test('clinical notes and keys are not stored in plain text', async () => {
    await (await import('../src/models/stateStore.js')).stateStore.flush(); // writes are coalesced
    const raw = fs.readFileSync(process.env.STATE_FILE_PATH as string, 'utf8');
    assert.ok(!raw.includes('Hemoglobin 9.1 g/dL'), 'notes must be encrypted at rest');
    assert.match(raw, /"reportSealed": "n1\|v1\./);
    const saved = JSON.parse(raw).reports.find((r: Json) => r.reportId === reportId);
    assert.match(saved.encryption.wrappedKey, /^v1\.[0-9a-f]{16}\./, 'only a wrapped data key is stored');
    assert.equal(saved.encryption.algorithm, 'aes-256-gcm');
  });

  test('record lists never expose encryption parameters', async () => {
    const list = await get('/api/records', patient);
    const rec = list.json.data.find((r: Json) => r.reportId === reportId);
    assert.equal(rec.encrypted, true);
    assert.equal(rec.fileAvailable, true);
    assert.equal(rec.report, 'Hemoglobin 9.1 g/dL (LOW)', 'the owner still reads their notes');
    assert.equal(rec.encryption, undefined);
    assert.equal(rec.storage, undefined);
    assert.ok(!JSON.stringify(list.json).includes('wrappedKey'));
  });

  test('notes-only uploads become an encrypted text file', async () => {
    const up = await upload(patient, { clinicalNotes: 'BP 128/84 mmHg. Tab Telma 40 mg.', reportTitle: 'BP check' });
    assert.equal(up.status, 201);
    const dl = await get(`/api/records/${up.body.data.reportId}/download`, patient);
    assert.equal(dl.status, 200);
    assert.equal(dl.buf.toString('utf8'), 'BP 128/84 mmHg. Tab Telma 40 mg.');
    assert.match(dl.headers.get('content-disposition') || '', /BP check\.txt/);
  });

  test('the integrity check endpoint confirms every layer', async () => {
    const v = await get(`/api/records/${reportId}/verify`, patient);
    assert.equal(v.status, 200);
    assert.equal(v.json.data.verified, true);
    assert.equal(v.json.data.ciphertextIntact, true);
    assert.equal(v.json.data.decrypts, true);
    assert.equal(v.json.data.fingerprintMatches, true);
    assert.equal(v.json.data.blockchainAnchored, true);
  });
});

describe('tamper detection', () => {
  test('a changed byte in the stored file is detected and nothing is released', async () => {
    const up = await upload(patient, { clinicalNotes: 'x' }, { name: 'scan.pdf', bytes: PDF });
    const id = up.body.data.reportId;
    const file = path.join(STORE_DIR, `${id}.enc`);
    const bytes = fs.readFileSync(file);
    bytes[100] ^= 0xff;
    fs.writeFileSync(file, bytes);

    const dl = await get(`/api/records/${id}/download`, patient);
    assert.equal(dl.status, 409);
    assert.equal(dl.json.tampered, true);
    assert.ok(!dl.buf.includes(Buffer.from(MARKER)));

    const v = await get(`/api/records/${id}/verify`, patient);
    assert.equal(v.json.data.verified, false);
    assert.equal(v.json.data.ciphertextIntact, false);

    const { stateStore } = await import('../src/models/stateStore.js');
    assert.ok(stateStore.getState().auditLogs?.some((a) => a.action === 'RECORD_TAMPER_DETECTED' && (a.details as Json)?.reportId === id));
  });

  test('swapping encrypted files between records fails authentication (AAD binding)', async () => {
    const a = (await upload(patient, { clinicalNotes: 'a' }, { name: 'a.pdf', bytes: PDF })).body.data.reportId;
    const b = (await upload(patient, { clinicalNotes: 'b' }, { name: 'b.txt', bytes: Buffer.from('other file') })).body.data.reportId;
    const { stateStore } = await import('../src/models/stateStore.js');
    const ra = stateStore.getState().reports.find((r) => r.reportId === a)!;
    const rb = stateStore.getState().reports.find((r) => r.reportId === b)!;
    // an attacker with database access copies A's file, key and IV onto B
    rb.storage = { ...ra.storage! };
    rb.encryption = { ...ra.encryption! };
    const dl = await get(`/api/records/${b}/download`, patient);
    assert.equal(dl.status, 409);
    assert.equal(dl.json.tampered, true);
  });
});

describe('upload validation', () => {
  test('executables and disguised files are rejected by content, not by name', async () => {
    const exe = Buffer.concat([Buffer.from('MZ'), crypto.randomBytes(512)]);
    const r = await upload(patient, {}, { name: 'report.pdf', bytes: exe, type: 'application/pdf' });
    assert.equal(r.status, 415);
    assert.match(r.body.error, /not accepted/);
  });

  test('files over the size limit get a clear 413', async () => {
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(1.2 * 1024 * 1024, 0x41)]);
    const r = await upload(patient, {}, { name: 'big.pdf', bytes: big });
    assert.equal(r.status, 413);
    assert.match(r.body.error, /1 MB/);
  });

  test('file names are cleaned and the extension matches the real type', async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(64)]);
    const r = await upload(patient, {}, { name: '../../etc/x-ray', bytes: png });
    assert.equal(r.status, 201);
    assert.equal(r.body.data.fileName, 'x-ray.png');
    assert.equal(r.body.data.fileType, 'image/png');
  });

  test('a patient cannot file a record under another patient', async () => {
    const r = await upload(patient, { patientId: 'someone-else', clinicalNotes: 'note' });
    assert.equal(r.status, 201);
    const { stateStore } = await import('../src/models/stateStore.js');
    assert.equal(stateStore.getState().reports.find((x) => x.reportId === r.body.data.reportId)?.patientId, '90');
  });

  test('clinicians must name the patient', async () => {
    const r = await upload(doctor, { clinicalNotes: 'note' });
    assert.equal(r.status, 400);
  });
});

describe('who can open a file', () => {
  let patientFile = '';
  before(async () => {
    patientFile = (await upload(patient, { clinicalNotes: 'private' }, { name: 'mri.pdf', bytes: PDF })).body.data.reportId;
  });

  test('a doctor without consent is refused, and gets access once the patient grants it', async () => {
    assert.equal((await get(`/api/records/${patientFile}/download`, doctor)).status, 403);
    assert.equal((await get(`/api/records/${patientFile}/verify`, doctor)).status, 403);
    const { consentService } = await import('../src/services/consentService.js');
    await consentService.grant('90', '1593418229676', { userId: '90', role: 'patient' });
    assert.equal((await get(`/api/records/${patientFile}/download`, doctor)).status, 200);
    await consentService.revoke('90', '1593418229676', { userId: '90', role: 'patient' });
    assert.equal((await get(`/api/records/${patientFile}/download`, doctor)).status, 403);
  });

  test('labs and insurers cannot open patient files they did not upload; uploaders can', async () => {
    assert.equal((await get(`/api/records/${patientFile}/download`, lab)).status, 403);
    const up = await upload(lab, { patientId: '90', clinicalNotes: 'Lipid panel: LDL 162 mg/dL' });
    assert.equal(up.status, 201);
    assert.equal((await get(`/api/records/${up.body.data.reportId}/download`, lab)).status, 200);
    assert.equal((await get(`/api/records/${up.body.data.reportId}/download`, patient)).status, 200, 'the patient can open what was filed for them');
  });

  test('signed-out requests are refused', async () => {
    assert.equal((await get(`/api/records/${patientFile}/download`)).status, 401);
  });

  test('admins can see storage status without any key material', async () => {
    const s = await get('/api/records/storage/status', admin);
    assert.equal(s.status, 200);
    assert.equal(s.json.data.activeBackend, 'local');
    assert.ok(s.json.data.encryptedFiles >= 5);
    assert.match(s.json.data.currentKeyId, /^[0-9a-f]{16}$/);
    assert.equal((await get('/api/records/storage/status', patient)).status, 403);
  });
});

describe('older records and keys', () => {
  test('note-only records created before encrypted storage are migrated; others explain the missing file', async () => {
    const { stateStore } = await import('../src/models/stateStore.js');
    const { migrateLegacyRecords } = await import('../src/services/recordMigration.js');
    const text = 'Old note: SpO2 97%';
    stateStore.addReport({ reportId: '1000000000001', patientId: '90', fileName: 'old-note.txt', report: text, fileHash: `0x${crypto.createHash('sha256').update(text).digest('hex')}` });
    stateStore.addReport({ reportId: '1000000000002', patientId: '90', fileName: 'hp9.docx', report: 'Summary only', fileHash: '0x04a21f8828d1556e472ac7c4474fb99ad8fb873121ea69cfdc618d17284d5095' });
    const result = await migrateLegacyRecords();
    assert.equal(result.encrypted, 1);
    assert.ok(result.markedLegacy >= 1);

    const ok = await get('/api/records/1000000000001/download', patient);
    assert.equal(ok.status, 200);
    assert.equal(ok.buf.toString('utf8'), text);

    const missing = await get('/api/records/1000000000002/download', patient);
    assert.equal(missing.status, 404);
    assert.equal(missing.json.fileAvailable, false);
    assert.match(missing.json.error, /upload it again/);
    assert.equal((await migrateLegacyRecords()).encrypted, 0, 'migration is idempotent');
  });

  test('master-key rotation re-wraps data keys; files stay readable without the old key', async () => {
    const { config } = await import('../src/config/index.js');
    const { keyService } = await import('../src/services/keyService.js');
    const { rotateMasterKey } = await import('../src/services/recordMigration.js');
    const { stateStore } = await import('../src/models/stateStore.js');
    const oldKey = fs.readFileSync(config.masterKeyFile, 'utf8').trim();
    const oldId = keyService.currentKeyId;
    const id = (await upload(patient, { clinicalNotes: 'before rotation' }, { name: 'r.pdf', bytes: PDF })).body.data.reportId;

    // new key in use, old key kept only for decryption
    config.masterEncryptionKey = crypto.randomBytes(32).toString('hex');
    config.previousMasterKeys = [oldKey];
    keyService.reset();
    assert.notEqual(keyService.currentKeyId, oldId);
    assert.equal((await get(`/api/records/${id}/download`, patient)).status, 200, 'old records readable during rotation');

    const r = rotateMasterKey();
    assert.ok(r.rewrappedFiles >= 1);
    const rec = stateStore.getState().reports.find((x) => x.reportId === id)!;
    assert.equal(keyService.keyIdOf(rec.encryption!.wrappedKey), keyService.currentKeyId);

    // old key removed entirely
    config.previousMasterKeys = [];
    keyService.reset();
    const dl = await get(`/api/records/${id}/download`, patient);
    assert.equal(dl.status, 200);
    assert.ok(dl.buf.equals(PDF));
    await (await import('../src/models/stateStore.js')).stateStore.flush(); // writes are coalesced
    const saved = JSON.parse(fs.readFileSync(process.env.STATE_FILE_PATH as string, 'utf8')).reports as Json[];
    assert.ok(!saved.find((x) => x.reportId === id).encryption.wrappedKey.includes(`v1.${oldId}.`), 'file key moved to the new master key');
    assert.ok(saved.every((x) => !x.reportSealed || !x.reportSealed.includes(`|v1.${oldId}.`)), 'every note moved to the new master key');
    assert.deepEqual(r.failed.length, 1, 'only the deliberately altered record from the swap test could not be re-wrapped');
    // the audit trail moved to the new key too: every line still reads with the old key gone
    const auditLines = fs.readFileSync(`${process.env.STATE_FILE_PATH}.audit`, 'utf8').trim().split('\n');
    assert.ok(auditLines.length > 0 && auditLines.every((l) => !l.includes(`|v1.${oldId}.`)), 'audit lines re-sealed');
    assert.equal(stateStore.loadState().auditLogs!.length, auditLines.length, 'every audit line opens without the old key');
  });

  test('notes survive a restart (decrypted when the state file is loaded)', async () => {
    const { stateStore } = await import('../src/models/stateStore.js');
    await (await import('../src/models/stateStore.js')).stateStore.flush(); // writes are coalesced
    const reloaded = stateStore.loadState();
    assert.ok(reloaded.reports.some((r) => r.report === 'before rotation'));
  });

  test('a wrapped key cannot be unwrapped for a different record', async () => {
    const { keyService } = await import('../src/services/keyService.js');
    const wrapped = keyService.wrap(crypto.randomBytes(32), 'file:1');
    assert.throws(() => keyService.unwrap(wrapped, 'file:2'));
    assert.equal(keyService.unwrap(wrapped, 'file:1').length, 32);
  });
});
