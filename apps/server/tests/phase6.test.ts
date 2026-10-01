/**
 * Phase 6 – safety fixes found by the evaluation:
 *  - text read from an unclear scan never reaches the external model (until a person corrects it)
 *  - the stricter de-identification re-check (OCR-mangled names, long digit runs, e-mail-like tokens)
 *  - administrator consent changes are a break-glass override: reason required, patient told, history marked
 * Run with: npm test (inside apps/server). No real OpenAI calls are made — a fake client is injected.
 */
import { test, before, after, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medledger-phase6-'));
process.env.NODE_ENV = 'test';
process.env.STATE_FILE_PATH = path.join(tmpDir, 'state.json');
process.env.FILE_STORAGE_DIR = path.join(tmpDir, 'files');
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';
process.env.AUTH_RATE_LIMIT = '10000';
process.env.AI_RATE_LIMIT_PER_MIN = '10000';
process.env.DEMO_ACCOUNTS = 'true';
process.env.OPENAI_API_KEY = '';
process.env.OCR_ENABLED = 'false';

type Json = Record<string, any>;
let server: Server;
let base = '';
const t: Record<string, string> = {};
const ids: Record<string, string> = {};

const call = async (method: string, url: string, token?: string, body?: unknown) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};
const tokenFor = async (email: string, password: string) =>
  (await call('POST', '/api/auth/login', undefined, { email, password })).body.data.token as string;

const REPORT = 'Hemoglobin: 9.1 g/dL\nFasting blood sugar: 140 mg/dL';
let sent: string[] = [];
const fakeModel = {
  chat: {
    completions: {
      create: async (params: Record<string, any>) => {
        sent.push(JSON.stringify(params.messages));
        return { choices: [{ message: { content: JSON.stringify({ summary: 'Two values are outside the usual range.', keyFindings: [], abnormalValues: [], questionsForDoctor: ['Q1', 'Q2', 'Q3'], recommendations: [] }) } }] };
      }
    }
  }
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
  t.admin = await tokenFor('admin@medledger.demo', 'admin123');
  ids.patient = String((await call('GET', '/api/auth/profile', t.patient)).body.data.userId);
  ids.doctor = String((await call('GET', '/api/auth/profile', t.doctor)).body.data.userId);
});

after(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  sent = [];
  const { aiService } = await import('../src/services/aiService.js');
  aiService.setClient(null);
});

/** Adds a report whose text looks as if OCR read it with the given confidence. */
const addOcrReport = async (confidence: number, cleanedPhoto = false): Promise<string> => {
  const form = new FormData();
  form.append('clinicalNotes', 'scan');
  const up = (await (await fetch(`${base}/api/records/upload`, { method: 'POST', headers: { Authorization: `Bearer ${t.patient}` }, body: form })).json()) as Json;
  const reportId = String(up.data.reportId);
  // let the background text reader finish first, so it does not overwrite the simulated OCR result
  for (let i = 0; i < 100; i++) {
    const st = (await call('GET', `/api/records/${reportId}/text`, t.patient)).body.data?.extraction?.status;
    if (st && st !== 'pending' && st !== 'processing') break;
    await new Promise((r) => setTimeout(r, 50));
  }
  const { stateStore } = await import('../src/models/stateStore.js');
  stateStore.updateReport(reportId, {
    report: '',
    extractedText: REPORT,
    textExtraction: { status: 'done', method: 'ocr', confidence, ...(cleanedPhoto ? { cleanedPhoto: true } : {}), updatedAt: new Date().toISOString() }
  });
  return reportId;
};

describe('text from unclear scans stays on the built-in engine', () => {
  test('low OCR confidence: no external call, and the user is told why', async () => {
    const { aiService } = await import('../src/services/aiService.js');
    aiService.setClient(fakeModel);
    const reportId = await addOcrReport(45);
    const r = await call('POST', '/api/ai/summarize', t.patient, { reportId });
    assert.equal(r.status, 200);
    assert.equal(sent.length, 0, 'nothing may be sent to the external model');
    assert.equal(r.body.data.engine, 'local');
    assert.match(r.body.data.privacyNotice, /unclear image/);
    assert.ok(r.body.data.abnormalValues.length >= 1, 'the built-in engine still answers');
  });

  test('high OCR confidence: the external model may be used', async () => {
    const { aiService } = await import('../src/services/aiService.js');
    aiService.setClient(fakeModel);
    const reportId = await addOcrReport(92);
    const r = await call('POST', '/api/ai/summarize', t.patient, { reportId });
    assert.equal(r.status, 200);
    assert.equal(sent.length, 1);
    assert.equal(r.body.data.engine, 'openai');
    assert.equal(r.body.data.privacyNotice, undefined);
  });

  test('a noisy photo that needed clean-up stays local even when it read confidently', async () => {
    const { aiService } = await import('../src/services/aiService.js');
    aiService.setClient(fakeModel);
    const reportId = await addOcrReport(91, true);
    const r = await call('POST', '/api/ai/summarize', t.patient, { reportId });
    assert.equal(sent.length, 0);
    assert.equal(r.body.data.engine, 'local');
  });

  test('after the patient corrects the text, the external model may be used', async () => {
    const { aiService } = await import('../src/services/aiService.js');
    aiService.setClient(fakeModel);
    const reportId = await addOcrReport(30);
    const fix = await call('PUT', `/api/records/${reportId}/text`, t.patient, { text: REPORT + '\nPlatelets: 250000 /uL' });
    assert.equal(fix.status, 200);
    assert.equal(fix.body.data.extraction.corrected, true);
    const r = await call('POST', '/api/ai/summarize', t.patient, { reportId });
    assert.equal(sent.length, 1);
    assert.equal(r.body.data.engine, 'openai');
    const text = await call('GET', `/api/records/${reportId}/text`, t.patient);
    assert.match(text.body.data.text, /Platelets/);
  });

  test('only the patient, the uploader or an administrator can correct the text', async () => {
    const reportId = await addOcrReport(30);
    assert.equal((await call('PUT', `/api/records/${reportId}/text`, t.doctor, { text: 'x' })).status, 403);
    assert.equal((await call('PUT', `/api/records/${reportId}/text`, t.patient, { text: '   ' })).status, 400);
  });
});

describe('stricter de-identification re-check', () => {
  test('catches OCR-mangled names, long digit runs and e-mail-like tokens', async () => {
    const { deidentify, scanForPII } = await import('../src/services/ai/deidentify.js');
    const text = 'Impression: Meena Bhattara1 was seen. Contact rneena.bhattarai21@yahoo com, ref 98415O2231. Hemoglobin 9.1 g/dL';
    const out = deidentify(text, ['Meena Bhattarai']).text;
    for (const leak of ['Bhattara1', 'rneena', '98415O2231', 'yahoo']) assert.ok(!out.includes(leak), `${leak} left in: ${out}`);
    assert.ok(out.includes('9.1 g/dL'), 'medical values are kept');
    assert.ok(scanForPII('Seen: Meena Bhattara1', ['Meena Bhattarai']).length > 0, 'the gate also catches the mangled name');
  });

  test('does not remove ordinary medical words or values', async () => {
    const { deidentify } = await import('../src/services/ai/deidentify.js');
    const text = 'Platelets: 250000 /uL (150000-450000). Anaemia noted. WBC 4000-11000. Sodium 138 mmol/L.';
    const out = deidentify(text, ['Anil Sharma', 'Meena Bhattarai']).text;
    for (const keep of ['250000', '150000-450000', 'Anaemia', '4000-11000', '138 mmol/L']) assert.ok(out.includes(keep), `${keep} was removed: ${out}`);
  });
});

describe('administrator consent changes are a break-glass override', () => {
  test('a reason is required', async () => {
    const r = await call('POST', '/api/access/grant', t.admin, { patientId: ids.patient, doctorId: ids.doctor });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /reason/i);
  });

  test('with a reason: applied, the patient sees it, and the history marks it', async () => {
    const reason = 'Unconscious patient in the emergency ward; treating doctor needs records.';
    const r = await call('POST', '/api/access/grant', t.admin, { patientId: ids.patient, doctorId: ids.doctor, reason });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.override.reason, reason);
    assert.equal(r.body.data.override.change, 'granted');

    const mine = await call('GET', '/api/access/status', t.patient);
    const entry = mine.body.data.entries.find((e: Json) => e.doctorId === ids.doctor);
    assert.equal(entry.status, 'granted');
    assert.equal(entry.override.reason, reason);

    const activity = await call('GET', '/api/admin/audit/me', t.patient);
    const list = Array.isArray(activity.body.data) ? activity.body.data : activity.body.data?.logs || [];
    assert.ok(list.some((l: Json) => l.action === 'ACCESS_OVERRIDE_GRANTED'), 'the patient’s activity shows the override');

    const blocks = await call('GET', '/api/blockchain/blocks', t.admin);
    const all = Array.isArray(blocks.body) ? blocks.body : Array.isArray(blocks.body.data) ? blocks.body.data : [];
    const last = all.filter((b: Json) => /^Shared with/i.test(String(b.type))).pop();
    assert.equal(last.payload?.confirmedWith ?? last.data?.confirmedWith, 'admin-override');
    assert.ok(!JSON.stringify(last).includes('emergency ward'), 'the reason stays off the record history');
  });

  test('the patient’s own next decision clears the override note', async () => {
    const r = await call('POST', '/api/access/revoke', t.patient, { doctorId: ids.doctor });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.override, null);
  });
});
