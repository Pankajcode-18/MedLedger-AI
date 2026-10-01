/**
 * Health trends and the chat assistant (Project Guide §6.4, §6.6):
 * report dates, home/clinic readings, dated trend series, and a saved, sourced conversation.
 * Run with: npm test (inside apps/server).
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medledger-trends-'));
process.env.NODE_ENV = 'test';
process.env.STATE_FILE_PATH = path.join(tmpDir, 'state.json');
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';
process.env.AUTH_RATE_LIMIT = '10000';
process.env.AI_RATE_LIMIT_PER_MIN = '10000';
process.env.DEMO_ACCOUNTS = 'true';
process.env.OPENAI_API_KEY = '';

type Json = Record<string, any>;
let server: Server;
let base = '';
let patient = '';
let doctor = '';
let lab = '';

const tokenFor = async (email: string, password: string): Promise<string> => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return ((await res.json()) as Json).data.token;
};

const call = async (method: string, url: string, token: string, body?: unknown) => {
  const res = await fetch(base + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};

const uploadNote = async (token: string, notes: string, patientId?: string) => {
  const form = new FormData();
  form.append('clinicalNotes', notes);
  form.append('reportTitle', 'Lab report');
  if (patientId) form.append('patientId', patientId);
  const res = await fetch(`${base}/api/records/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return (await res.json()) as Json;
};

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

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
});

after(async () => {
  const { textExtraction } = await import('../src/services/textExtraction.js');
  await textExtraction.whenIdle();
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('report dates', () => {
  test('the test date is read from the report, day first', async () => {
    const { clinicalDate } = await import('../src/services/recordText.js');
    const iso = (t: string) => clinicalDate(t)?.toISOString().slice(0, 10);
    assert.equal(iso('Sample Collected: 11/05/2024 08:30'), '2024-05-11');
    assert.equal(iso('Report Date 12 May 2024'), '2024-05-12');
    assert.equal(iso('Collection date: 2025-01-31'), '2025-01-31');
    assert.equal(iso('Date: 05/13/2024'), '2024-05-13', 'month first only when day first is impossible');
    assert.equal(iso('Reported on March 3, 2025'), '2025-03-03');
    assert.equal(clinicalDate('Report Date: 2081-05-12 (B.S.)'), null, 'future (Bikram Sambat) years are ignored');
    assert.equal(clinicalDate('Hemoglobin 12.5 g/dL'), null);
  });
});

describe('home and clinic readings', () => {
  test('a patient records readings; impossible values are refused', async () => {
    const ok = await call('POST', '/api/vitals', patient, { type: 'bp', value: 142, value2: 90, takenAt: daysAgo(1), note: 'after morning walk' });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.origin, 'home');

    const f = await call('POST', '/api/vitals', patient, { type: 'temperature', value: 101.3, unit: 'F', takenAt: daysAgo(2) });
    assert.equal(f.body.data.value, 38.5, '°F is stored as °C');

    for (const [bad, msg] of [
      [{ type: 'bp', value: 142 }, /both numbers/],
      [{ type: 'bp', value: 80, value2: 120 }, /higher than the second/],
      [{ type: 'spo2', value: 120 }, /between 50 and 100/],
      [{ type: 'heart_rate', value: 70, takenAt: new Date(Date.now() + 86_400_000).toISOString() }, /future/],
      [{ type: 'mood', value: 5 }, /./]
    ] as const) {
      const r = await call('POST', '/api/vitals', patient, bad);
      assert.equal(r.status, 400, JSON.stringify(bad));
      assert.match(r.body.error, msg);
    }
    const list = await call('GET', '/api/vitals', patient);
    assert.equal(list.body.data.readings.length, 2);
  });

  test('readings are encrypted at rest', async () => {
    await (await import('../src/models/stateStore.js')).stateStore.flush(); // writes are coalesced
    const raw = fs.readFileSync(process.env.STATE_FILE_PATH as string, 'utf8');
    assert.ok(!raw.includes('after morning walk'));
    assert.match(raw, /"vitalsSealed": "n1\|/);
    assert.ok(!/"vitals":\s*\[/.test(raw));
  });

  test('doctors need consent; labs cannot add readings; only the author deletes', async () => {
    assert.equal((await call('GET', '/api/vitals?patientId=90', doctor)).status, 403);
    assert.equal((await call('POST', '/api/vitals', doctor, { patientId: '90', type: 'heart_rate', value: 88 })).status, 403);
    assert.equal((await call('POST', '/api/vitals', lab, { patientId: '90', type: 'heart_rate', value: 88 })).status, 403);

    const { consentService } = await import('../src/services/consentService.js');
    await consentService.grant('90', '1593418229676', { userId: '90', role: 'patient' });
    const clinic = await call('POST', '/api/vitals', doctor, { patientId: '90', type: 'heart_rate', value: 88, takenAt: daysAgo(3) });
    assert.equal(clinic.status, 201);
    assert.equal(clinic.body.data.origin, 'clinic');

    assert.equal((await call('DELETE', `/api/vitals/${clinic.body.data.id}`, patient)).status, 403);
    assert.equal((await call('DELETE', `/api/vitals/${clinic.body.data.id}`, doctor)).status, 200);
    await consentService.revoke('90', '1593418229676', { userId: '90', role: 'patient' });
  });
});

describe('trends', () => {
  test('reports (by test date) and home readings form one dated series', async () => {
    await uploadNote(patient, 'CITY LAB\nSample Collected: 10/01/2026\nFasting Blood Sugar 142 mg/dL (HIGH)');
    await uploadNote(lab, 'Report Date: 15 Jun 2026\nFasting Blood Sugar 118 mg/dL', '90');
    await call('POST', '/api/vitals', patient, { type: 'fasting_glucose', value: 108, takenAt: daysAgo(1) });

    const r = await call('POST', '/api/ai/trends', patient, {});
    assert.equal(r.status, 200);
    const sugar = r.body.data.series.find((s: Json) => s.key === 'fasting_glucose');
    assert.deepEqual(sugar.points.map((p: Json) => p.value), [142, 118, 108], 'oldest first, by test date');
    assert.equal(sugar.points[0].date.slice(0, 10), '2026-01-10');
    assert.deepEqual(sugar.points.map((p: Json) => p.origin), ['report', 'report', 'home']);
    assert.equal(sugar.direction, 'falling');
    assert.ok(sugar.rangeHigh >= 99 && sugar.rangeHigh <= 100, 'normal band for the chart');
    assert.equal(sugar.latestStatus, 'high');

    const bp = r.body.data.series.find((s: Json) => s.key === 'systolic_bp');
    assert.equal(bp.points[bp.points.length - 1].value, 142, 'the home reading is the newest point');
    assert.equal(bp.points[bp.points.length - 1].origin, 'home');
    assert.ok(r.body.data.series.find((s: Json) => s.key === 'diastolic_bp'));
  });
});

describe('chat assistant', () => {
  test('answers trend questions from dated values and names its sources', async () => {
    const r = await call('POST', '/api/ai/chat', patient, { message: 'Is my fasting sugar improving?' });
    assert.equal(r.status, 200);
    const reply: string = r.body.data.reply;
    assert.match(reply, /latest fasting blood sugar was 108 mg\/dL/);
    assert.match(reply, /come down/);
    assert.match(reply, /informational only/i);
    const labels = r.body.data.sources.map((s: Json) => s.label);
    assert.ok(labels.some((l: string) => /Home reading/.test(l)), JSON.stringify(labels));
    assert.ok(r.body.data.sources.every((s: Json) => s.date));
  });

  test('blood pressure is answered as a pair, from the newest reading', async () => {
    const r = await call('POST', '/api/ai/chat', patient, { message: 'What was my blood pressure?' });
    assert.match(r.body.data.reply, /142\/90 mmHg/);
    assert.match(r.body.data.reply, /above the normal range/);
  });

  test('the conversation is saved (encrypted) and can be cleared', async () => {
    const h = await call('GET', '/api/ai/chat/history', patient);
    assert.equal(h.body.data.messages.length, 4);
    assert.equal(h.body.data.messages[0].role, 'user');
    assert.ok(h.body.data.messages[1].sources.length >= 1);

    await (await import('../src/models/stateStore.js')).stateStore.flush(); // writes are coalesced
    const raw = fs.readFileSync(process.env.STATE_FILE_PATH as string, 'utf8');
    assert.ok(!raw.includes('Is my fasting sugar improving'));
    assert.match(raw, /"chatsSealed": "n1\|/);

    // a follow-up uses the saved history
    const follow = await call('POST', '/api/ai/chat', patient, { message: 'and my heart rate?' });
    assert.equal(follow.status, 200);

    assert.equal((await call('DELETE', '/api/ai/chat/history', patient)).status, 200);
    assert.equal((await call('GET', '/api/ai/chat/history', patient)).body.data.messages.length, 0);
  });

  test('clinicians cannot read a patient conversation or chat about them without consent', async () => {
    assert.equal((await call('GET', '/api/ai/chat/history?patientId=90', doctor)).status, 403);
    assert.equal((await call('POST', '/api/ai/chat', doctor, { message: 'latest sugar?', patientId: '90' })).status, 403);
  });

  test('older clients that send the message list still work', async () => {
    const r = await call('POST', '/api/ai/chat', patient, { messages: [{ role: 'user', content: 'What was my fasting sugar?' }] });
    assert.equal(r.status, 200);
    assert.match(r.body.data.reply, /108 mg\/dL/);
  });

  test("the doctor's chart synthesis includes the patient's readings once access is granted", async () => {
    const { consentService } = await import('../src/services/consentService.js');
    await consentService.grant('90', '1593418229676', { userId: '90', role: 'patient' });
    const r = await call('POST', '/api/ai/doctor/chart-synthesis', doctor, { patientId: '90' });
    assert.equal(r.status, 200);
    const sugar = r.body.data.series.find((s: Json) => s.key === 'fasting_glucose');
    assert.equal(sugar.points.length, 3);
    await consentService.revoke('90', '1593418229676', { userId: '90', role: 'patient' });
  });
});
