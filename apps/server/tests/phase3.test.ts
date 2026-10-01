/**
 * Phase 3 – one source of truth for "who can see what": per-doctor consent, the status endpoint,
 * record lists scoped by role, and server-side dashboard counts.
 * Run with: npm test (inside apps/server).
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medledger-phase3-'));
process.env.NODE_ENV = 'test';
process.env.STATE_FILE_PATH = path.join(tmpDir, 'state.json');
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';
process.env.AUTH_RATE_LIMIT = '10000';
process.env.DEMO_ACCOUNTS = 'true';
process.env.OPENAI_API_KEY = '';

type Json = Record<string, any>;
let server: Server;
let base = '';
const t: Record<string, string> = {};
let doctorB = '';

const post = async (url: string, body: unknown, token?: string) => {
  const res = await fetch(base + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};
const get = async (url: string, token?: string) => {
  const res = await fetch(base + url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};
const tokenFor = async (email: string, password: string) => (await post('/api/auth/login', { email, password })).body.data.token as string;
const upload = async (token: string, notes: string, patientId?: string) => {
  const form = new FormData();
  form.append('clinicalNotes', notes);
  form.append('reportTitle', 'Blood test');
  if (patientId) form.append('patientId', patientId);
  const res = await fetch(`${base}/api/records/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, body: (await res.json()) as Json };
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
  t.lab = await tokenFor('lab@medledger.demo', 'lab123');
  t.insurance = await tokenFor('insurance@medledger.demo', 'insurance123');
  const reg = await post('/api/auth/register', { name: 'Dr. Sunita Karki', email: 'sunita@example.com', password: 'Str0ngPass!9', role: 'doctor' });
  t.doctorB = reg.body.data.token;
  doctorB = reg.body.data.user.userId;
});

after(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('directories', () => {
  test('patients are listed only to staff; doctors to anyone signed in', async () => {
    assert.equal((await get('/patientdatas')).status, 401);
    assert.equal((await get('/patientdatas', t.patient)).status, 403);
    const list = await get('/patientdatas', t.doctor);
    assert.equal(list.status, 200);
    assert.ok(list.body.every((p: Json) => !('adharNo' in p) && !('address' in p)));
    assert.equal((await get('/doctordatas')).status, 401);
    const docs = await get('/api/access/doctors?q=karki', t.patient);
    assert.equal(docs.body.data.length, 1);
    assert.equal(docs.body.data[0].doctorId, doctorB);
    assert.ok(!('email' in docs.body.data[0]));
  });
});

describe('consent, per doctor', () => {
  test('a request is between one doctor and one patient', async () => {
    const r = await post('/api/access/request', { patientId: '90', reason: 'Follow-up of sugar levels' }, t.doctorB);
    assert.equal(r.status, 200);
    assert.equal(r.body.data.status, 'pending');

    const mine = await get('/api/access/status', t.patient);
    const entry = mine.body.data.entries.find((e: Json) => e.doctorId === doctorB);
    assert.equal(entry.status, 'pending');
    assert.equal(entry.doctorName, 'Dr. Sunita Karki');
    assert.equal(entry.reason, 'Follow-up of sugar levels');
    // the seeded demo data also has an open request from the demo doctor
    assert.equal(mine.body.data.counts.pending, 2);

    const own = await get('/api/access/status', t.doctorB);
    assert.equal(own.body.data.entries.length, 1);
    const other = await get('/api/access/status', t.doctor);
    assert.ok(other.body.data.entries.every((e: Json) => e.reason !== 'Follow-up of sugar levels'), 'the other doctor does not see this request');
  });

  test('only the patient decides, and only about their own records', async () => {
    assert.equal((await post('/api/access/grant', { doctorId: doctorB }, t.doctor)).status, 403);
    assert.equal((await post('/api/access/grant', { patientId: '91', doctorId: doctorB }, t.patient)).status, 403);
    assert.equal((await post('/api/access/grant', { doctorId: 'nobody' }, t.patient)).status, 404);
    assert.equal((await post('/api/access/request', { patientId: '90' }, t.lab)).status, 403);
  });

  test('declining closes the request without giving access', async () => {
    const d = await post('/api/access/decline', { doctorId: doctorB }, t.patient);
    assert.equal(d.body.data.status, 'declined');
    assert.equal((await get('/api/records', t.doctorB)).body.data.length, 0);
    assert.equal((await post('/api/access/decline', { doctorId: doctorB }, t.patient)).status, 404);
  });
});

describe('grant, use, revoke — every view agrees', () => {
  let reportId = '';

  test('before sharing: nothing to see, counts zero', async () => {
    reportId = (await upload(t.patient, 'Haemoglobin 13.1 g/dL')).body.data.reportId;
    assert.equal((await get('/api/records', t.doctor)).body.data.length, 0);
    assert.equal((await get(`/api/records/${reportId}/download`, t.doctor)).status, 403);
    const s = (await get('/api/summary', t.doctor)).body.data;
    assert.equal(s.patientsSharing, 0);
    assert.equal(s.records, 0);
  });

  test('after sharing: list, download, counts and status all say yes', async () => {
    const g = await post('/api/access/grant', { doctorId: '1593418229676' }, t.patient);
    assert.equal(g.status, 200);
    const patientRecords = (await get('/api/records', t.patient)).body.data.length;
    const doctorRecords = (await get('/api/records', t.doctor)).body.data;
    assert.equal(doctorRecords.length, patientRecords);
    assert.equal((await get(`/api/records/${reportId}/download`, t.doctor)).status, 200);

    const ds = (await get('/api/summary', t.doctor)).body.data;
    assert.equal(ds.patientsSharing, 1);
    assert.equal(ds.records, patientRecords);
    const ps = (await get('/api/summary', t.patient)).body.data;
    assert.equal(ps.doctorsWithAccess, 1);
    assert.equal(ps.records, patientRecords);
    const st = (await get('/api/access/status', t.doctor)).body.data;
    assert.equal(st.counts.granted, 1);
    assert.equal(st.entries[0].patientName, 'Tanmay Shishodia');

    // a report added later is shared too
    const later = (await upload(t.lab, 'Fasting sugar 110 mg/dL', '90')).body.data.reportId;
    assert.ok((await get('/api/records', t.doctor)).body.data.some((r: Json) => r.reportId === later));
    // but the other doctor still sees nothing
    assert.equal((await get('/api/records', t.doctorB)).body.data.length, 0);
  });

  test('permissions are stored encrypted and survive without the in-memory ledger', async () => {
    await (await import('../src/models/stateStore.js')).stateStore.flush(); // writes are coalesced
    const raw = fs.readFileSync(process.env.STATE_FILE_PATH as string, 'utf8');
    assert.match(raw, /"consentsSealed": "n1\|/);
    // access comes from the saved permissions, not from the record history
    const { stateStore } = await import('../src/models/stateStore.js');
    const saved = stateStore.getState().blocks;
    stateStore.getState().blocks = [];
    try {
      assert.equal((await get(`/api/records/${reportId}/download`, t.doctor)).status, 200);
    } finally {
      stateStore.getState().blocks = saved;
    }
  });

  test('after revoking: nothing to see again, and the patient still sees the history', async () => {
    const r = await post('/api/access/revoke', { doctorId: '1593418229676' }, t.patient);
    assert.equal(r.status, 200);
    assert.equal((await get('/api/records', t.doctor)).body.data.length, 0);
    assert.equal((await get(`/api/records/${reportId}/download`, t.doctor)).status, 403);
    assert.equal((await get('/api/summary', t.doctor)).body.data.patientsSharing, 0);
    const mine = (await get('/api/access/status', t.patient)).body.data;
    assert.equal(mine.entries.find((e: Json) => e.doctorId === '1593418229676').status, 'revoked');
    assert.equal(mine.counts.granted, 0);
    assert.equal((await get('/api/access/status', t.doctor)).body.data.entries.length, 0);
    // a doctor without permission cannot add notes to the record either
    assert.equal((await upload(t.doctor, 'note', '90')).status, 403);
  });
});

describe('record lists by role', () => {
  test('lab sees its own uploads; insurer only reports attached to its claims', async () => {
    const lab = (await get('/api/records', t.lab)).body.data;
    assert.ok(lab.length >= 1 && lab.every((r: Json) => r.uploadedBy === 'lab-01'));
    const ins = (await get('/api/records', t.insurance)).body.data;
    assert.deepEqual(
      ins.map((r: Json) => r.reportId),
      ['1593418802454'],
      'the sample claim for patient 90 points at the seeded report'
    );
  });
});

describe('activity log', () => {
  test('entries carry readable names, and a patient log is private', async () => {
    const mine = (await get('/api/admin/audit/me', t.patient)).body.data as Json[];
    const grant = mine.find((l) => l.action === 'ACCESS_GRANTED');
    assert.equal(grant.doctorName, 'Dr. Anil Sharma');
    assert.equal(grant.actorName, 'Tanmay Shishodia');
    const opened = (await get('/api/admin/audit/me', t.doctor)).body.data.find((l: Json) => l.action === 'RECORD_DOWNLOADED');
    assert.equal(opened.recordTitle, 'Blood test');
    assert.equal(opened.patientName, 'Tanmay Shishodia');
    assert.equal((await get('/api/admin/audit/90', t.lab)).status, 403);
    assert.equal((await get('/api/admin/audit/90', t.patient)).status, 200);
    assert.equal((await get('/api/admin/stats')).status, 401);
  });
});
