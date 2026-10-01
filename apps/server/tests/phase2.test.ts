/**
 * Phase 2 – real data: hospital staff and admissions, lab samples, insurance claims and policyholders,
 * the organisation register, and renaming older demo accounts.
 * Run with: npm test (inside apps/server).
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medledger-phase2-'));
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

const tokenFor = async (email: string, password: string): Promise<string> => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const body = (await res.json()) as Json;
  assert.ok(body.data?.token, `login ${email}: ${JSON.stringify(body)}`);
  return body.data.token;
};

const call = async (method: string, url: string, token: string, body?: unknown) => {
  const res = await fetch(base + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};

before(async () => {
  // an older state file with the previous demo addresses (the password stays what it was)
  const bcrypt = (await import('bcryptjs')).default;
  const oldHash = await bcrypt.hash('secret99', 4);
  fs.writeFileSync(
    process.env.STATE_FILE_PATH as string,
    JSON.stringify({
      patients: [],
      doctors: [{ doctorId: '1593418229676', name: 'Dr. Gregory House', email: 'house@princeton.edu', licenseId: 'DOC-MH-10293', type: 'doctor' }],
      reports: [],
      blocks: [],
      users: [
        {
          userId: '1593418229676',
          email: 'house@princeton.edu',
          role: 'doctor',
          name: 'Dr. Gregory House',
          passwordHash: oldHash,
          isDemo: true
        }
      ]
    })
  );
  const { createApp } = await import('../src/app.js');
  const { userStore } = await import('../src/services/userStore.js');
  await userStore.seedDemoAccounts();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.patient = await tokenFor('patient@medledger.demo', 'secret99');
  t.hospital = await tokenFor('hospital@medledger.demo', 'hospital123');
  t.lab = await tokenFor('lab@medledger.demo', 'lab123');
  t.insurance = await tokenFor('insurance@medledger.demo', 'insurance123');
  t.admin = await tokenFor('admin@medledger.demo', 'admin123');
});

after(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('older demo accounts', () => {
  test('are renamed in place, keeping their id', async () => {
    await (await import('../src/models/stateStore.js')).stateStore.flush(); // writes are coalesced
    const state = JSON.parse(fs.readFileSync(process.env.STATE_FILE_PATH as string, 'utf8'));
    const doc = state.users.find((u: Json) => u.userId === '1593418229676');
    assert.equal(doc.email, 'doctor@medledger.demo');
    assert.equal(doc.name, 'Dr. Anil Sharma');
    assert.ok(!JSON.stringify(state.doctors).includes('House'));
  });
});

describe('sample rows for the demo organisations', () => {
  test('each organisation sees only its own rows', async () => {
    const staff = await call('GET', '/api/staff', t.hospital);
    assert.equal(staff.status, 200);
    assert.equal(staff.body.data.length, 4);
    assert.ok(staff.body.data.every((s: Json) => s.orgId === 'hosp-01'));
    assert.equal((await call('GET', '/api/staff', t.lab)).status, 403);
    assert.equal((await call('GET', '/api/claims', t.hospital)).status, 403);
    assert.equal((await call('GET', '/api/samples', t.lab)).body.data.length, 4);
    assert.equal((await call('GET', '/api/organisations', t.admin)).body.data.length, 5);
  });

  test('stored encrypted, with no names on disk', async () => {
    await (await import('../src/models/stateStore.js')).stateStore.flush(); // writes are coalesced
    const raw = fs.readFileSync(process.env.STATE_FILE_PATH as string, 'utf8');
    assert.ok(!raw.includes('Hari Prasad Poudel'));
    assert.ok(!raw.includes('SHI-2026-0090'));
    assert.match(raw, /"claimsSealed": "n1\|/);
    assert.match(raw, /"staffSealed": "n1\|/);
  });
});

describe('hospital', () => {
  test('adds staff, admits and discharges, and a discharged patient cannot be re-admitted by status', async () => {
    const bad = await call('POST', '/api/staff', t.hospital, { name: 'Asha', role: 'Nurse', department: 'Ward', phone: 'call me' });
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /phone number/);
    const s = await call('POST', '/api/staff', t.hospital, { name: 'Asha Lama', role: 'Nurse', department: 'Ward B', phone: '+977 9800000001' });
    assert.equal(s.status, 201);
    assert.equal((await call('GET', '/api/staff', t.hospital)).body.data.length, 5);

    const a = await call('POST', '/api/admissions', t.hospital, { patientName: 'Ram Thapa', ward: 'Ward B', bed: '7', doctorName: 'Dr. Anil Sharma' });
    assert.equal(a.status, 201);
    assert.equal(a.body.data.status, 'Admitted');
    const d = await call('PATCH', `/api/admissions/${a.body.data.id}`, t.hospital, { status: 'Discharged' });
    assert.equal(d.body.data.status, 'Discharged');
    assert.ok(d.body.data.dischargedAt);
    assert.equal((await call('PATCH', `/api/admissions/${a.body.data.id}`, t.hospital, { status: 'Admitted' })).status, 409);
  });

  test('the pharmacy sees medicines for admitted patients', async () => {
    const { consentService } = await import('../src/services/consentService.js');
    await consentService.grant('90', '1593418229676', { userId: '90', role: 'patient' });
    const doctor = await tokenFor('doctor@medledger.demo', 'secret99');
    await call('POST', '/api/prescriptions', doctor, { patientId: '90', drugName: 'Metformin', dosage: '500 mg', frequency: 'Twice daily', duration: '30 days' });
    const rx = await call('GET', '/api/prescriptions', t.hospital);
    assert.equal(rx.status, 200);
    assert.ok(rx.body.data.some((p: Json) => p.drugName === 'Metformin'), 'patient 90 is admitted in the sample data');
    await consentService.revoke('90', '1593418229676', { userId: '90', role: 'patient' });
  });
});

describe('lab samples', () => {
  test('move forward one step at a time', async () => {
    const s = await call('POST', '/api/samples', t.lab, { patientName: 'Ram Thapa', test: 'CBC', priority: 'Urgent' });
    assert.equal(s.body.data.status, 'Received');
    assert.equal((await call('PATCH', `/api/samples/${s.body.data.id}`, t.lab, { status: 'Uploaded' })).status, 409);
    const p = await call('PATCH', `/api/samples/${s.body.data.id}`, t.lab, { status: 'Processing' });
    assert.equal(p.body.data.status, 'Processing');
    assert.equal((await call('PATCH', `/api/samples/${s.body.data.id}`, t.hospital, { status: 'Report ready' })).status, 403);
  });
});

describe('insurance claims', () => {
  test('approve then pay; amounts are checked; the patient sees their own claim', async () => {
    const c = await call('POST', '/api/claims', t.insurance, {
      patientName: 'Tanmay Shishodia',
      patientId: '90',
      policyNo: 'SHI-2026-0090',
      provider: 'Himal Care Hospital',
      service: 'X-ray',
      amount: 2500
    });
    assert.equal(c.status, 201);
    assert.equal(c.body.data.currency, 'NPR');
    const id = c.body.data.id;
    assert.equal((await call('PATCH', `/api/claims/${id}`, t.insurance, { status: 'Paid' })).status, 409, 'cannot pay before approval');
    assert.equal((await call('PATCH', `/api/claims/${id}`, t.insurance, { status: 'Approved', approvedAmount: 3000 })).status, 400);
    const ok = await call('PATCH', `/api/claims/${id}`, t.insurance, { status: 'Approved' });
    assert.equal(ok.body.data.approvedAmount, 2500);
    const paid = await call('PATCH', `/api/claims/${id}`, t.insurance, { status: 'Paid' });
    assert.equal(paid.body.data.status, 'Paid');
    assert.ok(paid.body.data.paidAt);

    const mine = await call('GET', '/api/claims', t.patient);
    assert.equal(mine.status, 200);
    assert.ok(mine.body.data.every((x: Json) => x.patientId === '90'));
    assert.ok(mine.body.data.some((x: Json) => x.id === id));
    assert.equal((await call('GET', '/api/policyholders', t.patient)).status, 403);
  });

  test('insurers cannot add documents to a patient record', async () => {
    const form = new FormData();
    form.append('patientId', '90');
    form.append('clinicalNotes', 'claim note');
    const res = await fetch(`${base}/api/records/upload`, { method: 'POST', headers: { Authorization: `Bearer ${t.insurance}` }, body: form });
    assert.equal(res.status, 403);
  });
});

describe('organisation register', () => {
  test('admins add and verify organisations; others cannot', async () => {
    const o = await call('POST', '/api/organisations', t.admin, { name: 'Dharan Eye Clinic', type: 'Clinic', district: 'Sunsari' });
    assert.equal(o.status, 201);
    assert.equal(o.body.data.verified, false);
    const v = await call('PATCH', `/api/organisations/${o.body.data.id}`, t.admin, { verified: true });
    assert.equal(v.body.data.verified, true);
    assert.equal((await call('POST', '/api/organisations', t.hospital, { name: 'X', type: 'Clinic' })).status, 403);
  });
});

describe('try a demo', () => {
  test('signs in to a sample account by role, without a password', async () => {
    const res = await fetch(`${base}/api/auth/demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'lab' }) });
    const body = (await res.json()) as Json;
    assert.equal(res.status, 200);
    assert.equal(body.data.user.role, 'lab');
    assert.equal(body.data.user.email, 'lab@medledger.demo');
    const hosp = (await (await fetch(`${base}/api/auth/demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'hospital' }) })).json()) as Json;
    assert.equal(hosp.data.user.role, 'hospital-admin');
    const bad = await fetch(`${base}/api/auth/demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'root' }) });
    assert.equal(bad.status, 400);
  });
});
