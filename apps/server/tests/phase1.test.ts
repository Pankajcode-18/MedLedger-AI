/**
 * Phase 1 – no fake results: saved settings, stored prescriptions, real admin security figures
 * and the demo-mode flag the client uses for its "sample data" banner.
 * Run with: npm test (inside apps/server).
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medledger-phase1-'));
process.env.NODE_ENV = 'test';
process.env.STATE_FILE_PATH = path.join(tmpDir, 'state.json');
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';
process.env.AUTH_RATE_LIMIT = '10000';
process.env.DEMO_ACCOUNTS = 'true';
process.env.OPENAI_API_KEY = '';

type Json = Record<string, any>;
let server: Server;
let base = '';
let patient = '';
let doctor = '';
let lab = '';
let admin = '';

const login = async (email: string, password: string) =>
  fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
const tokenFor = async (email: string, password: string): Promise<string> => ((await (await login(email, password)).json()) as Json).data.token;

const call = async (method: string, url: string, token: string, body?: unknown) => {
  const res = await fetch(base + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};

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

describe('demo mode flag', () => {
  test('health reports whether demo accounts are on', async () => {
    const res = (await (await fetch(`${base}/health`)).json()) as Json;
    assert.equal(res.demoMode, true);
  });
});

describe('saved settings', () => {
  test('values survive a reload, per user and per section, encrypted at rest', async () => {
    const empty = await call('GET', '/api/settings/notifications', patient);
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.data.values, {});

    const saved = await call('PUT', '/api/settings/profile', patient, {
      values: { phone: '+977 9812345678', bloodGroup: 'O+', emergencyName: 'Sita Sharma', smsAlerts: true }
    });
    assert.equal(saved.status, 200);

    const again = await call('GET', '/api/settings/profile', patient);
    assert.equal(again.body.data.values.bloodGroup, 'O+');
    assert.equal(again.body.data.values.smsAlerts, true);

    const other = await call('GET', '/api/settings/profile', doctor);
    assert.deepEqual(other.body.data.values, {}, 'another user does not see these values');

    await (await import('../src/models/stateStore.js')).stateStore.flush(); // writes are coalesced
    const raw = fs.readFileSync(process.env.STATE_FILE_PATH as string, 'utf8');
    assert.ok(!raw.includes('Sita Sharma'));
    assert.match(raw, /"settingsSealed": "n1\|/);
  });

  test('bad input is refused', async () => {
    assert.equal((await call('PUT', '/api/settings/BAD!', patient, { values: {} })).status, 400);
    assert.equal((await call('PUT', '/api/settings/profile', patient, { values: { nested: { a: 1 } } })).status, 400);
    assert.equal((await call('PUT', '/api/settings/profile', patient, { values: { note: 'x'.repeat(501) } })).status, 400);
    assert.equal((await call('GET', '/api/settings/profile', '')).status, 401);
  });
});

describe('prescriptions', () => {
  const rx = { patientId: '90', drugName: 'Metformin', dosage: '500 mg', frequency: 'Twice daily', duration: '30 days' };

  test('a doctor needs the patient to share records first', async () => {
    const r = await call('POST', '/api/prescriptions', doctor, rx);
    assert.equal(r.status, 403);
    assert.equal((await call('POST', '/api/prescriptions', lab, rx)).status, 403);
    assert.equal((await call('POST', '/api/prescriptions', patient, rx)).status, 403);
  });

  test('once shared, the prescription is stored and the patient sees it', async () => {
    const { consentService } = await import('../src/services/consentService.js');
    await consentService.grant('90', '1593418229676', { userId: '90', role: 'patient' });

    assert.equal((await call('POST', '/api/prescriptions', doctor, { ...rx, drugName: '' })).status, 400);
    const created = await call('POST', '/api/prescriptions', doctor, rx);
    assert.equal(created.status, 201);
    assert.equal(created.body.data.status, 'Active');

    const mine = await call('GET', '/api/prescriptions', doctor);
    assert.equal(mine.body.data.length, 1);
    const theirs = await call('GET', '/api/prescriptions', patient);
    assert.equal(theirs.body.data[0].drugName, 'Metformin');

    assert.equal((await call('PATCH', `/api/prescriptions/${created.body.data.id}`, patient, { status: 'Stopped' })).status, 403);
    const stopped = await call('PATCH', `/api/prescriptions/${created.body.data.id}`, doctor, { status: 'Stopped' });
    assert.equal(stopped.body.data.status, 'Stopped');

    await (await import('../src/models/stateStore.js')).stateStore.flush(); // writes are coalesced
    const raw = fs.readFileSync(process.env.STATE_FILE_PATH as string, 'utf8');
    assert.ok(!raw.includes('Metformin'));
    await consentService.revoke('90', '1593418229676', { userId: '90', role: 'patient' });
    assert.equal((await call('GET', '/api/prescriptions?patientId=90', doctor)).status, 403);
  });
});

describe('admin security figures', () => {
  test('failed sign-ins are counted from the activity log', async () => {
    const before = await call('GET', '/api/admin/security', admin);
    assert.equal(before.status, 200);
    await login('patient@medledger.demo', 'wrong-password');
    const after = await call('GET', '/api/admin/security', admin);
    assert.equal(after.body.data.failedSignIns, before.body.data.failedSignIns + 1);
    assert.equal(after.body.data.recent[0].action, 'LOGIN_FAILED');
    assert.ok(after.body.data.totalAccounts >= 6);
    assert.equal((await call('GET', '/api/admin/security', patient)).status, 403);
  });
});

describe('record checks used by the lab and insurance pages', () => {
  test('a fingerprint check finds stored files and rejects unknown or malformed ones', async () => {
    const form = new FormData();
    form.append('clinicalNotes', 'Haemoglobin 13.1 g/dL');
    form.append('reportTitle', 'Blood test');
    form.append('patientId', '90');
    const up = (await (
      await fetch(`${base}/api/records/upload`, { method: 'POST', headers: { Authorization: `Bearer ${lab}` }, body: form })
    ).json()) as Json;
    const hash: string = up.data.fileHash;

    const check = async (fileHash: string) => {
      const res = await fetch(`${base}/api/blockchain/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileHash })
      });
      return { status: res.status, body: (await res.json()) as Json };
    };
    const found = await check(hash.replace(/^0x/, '').toUpperCase());
    assert.equal(found.body.verified, true, 'found without 0x and in capitals');
    assert.equal(found.body.knownRecord, true);
    const missing = await check('ab'.repeat(32));
    assert.equal(missing.body.verified, false);
    assert.match(missing.body.message, /may have been changed/);
    assert.equal((await check('hello')).status, 400);

    // full check by report ID: the lab that uploaded it may run it; an insurer without consent may not
    const full = await call('GET', `/api/records/${up.data.reportId}/verify`, lab);
    assert.equal(full.status, 200);
    assert.equal(full.body.data.verified, true);
    const insurer = await tokenFor('insurance@medledger.demo', 'insurance123');
    assert.equal((await call('GET', `/api/records/${up.data.reportId}/verify`, insurer)).status, 403);
  });
});
