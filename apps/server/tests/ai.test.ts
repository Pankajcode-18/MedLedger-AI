/**
 * AI module tests (Project Guide §11.3 "AI Output Validation").
 * Run with: npm test (inside apps/server). No real OpenAI calls are made — a fake client is injected.
 */
import { test, before, after, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medledger-ai-'));
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

const call = async (method: string, url: string, body?: unknown, token?: string) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};
const tokenFor = async (email: string, password: string) =>
  (await call('POST', '/api/auth/login', { email, password })).body.data.token as string;

// ---------- The 10 sample reports used to prove de-identification (Guide §11.3) ----------
const SAMPLES: Array<{ text: string; pii: string[]; keep: string[] }> = [
  { text: 'Patient: Vikasini S, Age 21, DOB 12/03/2003 -- Hemoglobin: 10.2 g/dL (LOW), Sugar: 95 mg/dL', pii: ['Vikasini', '12/03/2003', 'Age 21'], keep: ['10.2 g/dL', '95 mg/dL'] },
  { text: 'Name: Ram Bahadur Thapa\nMRN: KTM-22831\nPhone: +977 9841234567\nAddress: Ward 4, Lalitpur\nHemoglobin 13.1 g/dL', pii: ['Ram Bahadur', 'KTM-22831', '9841234567', 'Lalitpur'], keep: ['13.1 g/dL'] },
  { text: 'Pt: Sita Sharma, 45/F. Email sita.sharma@gmail.com. Fasting blood sugar 132 mg/dL (HIGH).', pii: ['Sita', 'sita.sharma@gmail.com'], keep: ['132 mg/dL'] },
  { text: 'Aadhaar 5555 6666 7777, mobile 9812345678. Total Cholesterol 245 mg/dL.', pii: ['5555 6666 7777', '9812345678'], keep: ['245 mg/dL'] },
  { text: 'Referred by Dr. Anil Sharma. Patient: tanmay shishodia. BP 142/94 mmHg.', pii: ['Anil Sharma', 'tanmay'], keep: ['142/94'] },
  { text: 'Mr. Hari Prasad Koirala, Policy No: HS-99812, Claim No: CLM-802454. Creatinine 1.8 mg/dL.', pii: ['Hari Prasad', 'HS-99812', 'CLM-802454'], keep: ['1.8 mg/dL'] },
  { text: 'UHID: 0045123 | Date of Birth: 1 Jan 1990 | Platelets 90000 /uL', pii: ['0045123', '1 Jan 1990'], keep: ['90000'] },
  { text: 'Emergency Contact: Gita Rai, Ph: 01-4412345. TSH 6.2 mIU/L', pii: ['Gita Rai', '4412345'], keep: ['6.2 mIU/L'] },
  { text: 'Consultant: Dr. Allison Cameron (License: DOC-NY-9999). HbA1c 7.1 %', pii: ['Allison Cameron', 'DOC-NY-9999'], keep: ['7.1 %'] },
  { text: 'Patient Name: Arjun K. Wallet 0x495e7483db248DCA08B37121D15917Ae19D93C20. SpO2 91%', pii: ['Arjun', '0x495e7483db248DCA08B37121D15917Ae19D93C20'], keep: ['91%'] }
];

before(async () => {
  const { createApp } = await import('../src/app.js');
  const { userStore } = await import('../src/services/userStore.js');
  await userStore.seedDemoAccounts();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  const { aiService } = await import('../src/services/aiService.js');
  aiService.setClient(null);
});

describe('de-identification', () => {
  test('all 10 sample reports lose their identifiers but keep the medical values', async () => {
    const { deidentify } = await import('../src/services/ai/deidentify.js');
    for (const [i, s] of SAMPLES.entries()) {
      const out = deidentify(s.text, ['tanmay shishodia', 'Dr. Anil Sharma, M.D.']).text;
      for (const p of s.pii) assert.ok(!out.includes(p), `sample ${i + 1}: "${p}" leaked → ${out}`);
      for (const k of s.keep) assert.ok(out.includes(k), `sample ${i + 1}: medical value "${k}" was removed → ${out}`);
    }
  });

  test('ordinary sentences are not over-redacted', async () => {
    const { deidentify } = await import('../src/services/ai/deidentify.js');
    const text = 'Patient presents with cough. Test Name: Hemoglobin 13.1 g/dL. RBC 4500000 /uL.';
    assert.equal(deidentify(text).text, text);
  });
});

describe('abnormal value detection (3 layers)', () => {
  test('numeric comparator flags values against the guide reference table', async () => {
    const { extractClinicalData } = await import('../src/services/ai/clinicalExtractor.js');
    const ex = extractClinicalData(
      'Sex: Female. Hemoglobin 10.2 g/dL. Fasting Blood Sugar 132 mg/dL. Total Cholesterol 245 mg/dL. ' +
        'LDL 160 mg/dL. Creatinine 0.9 mg/dL. Platelets 2.6 lakh. WBC 6,800. TSH 2.1 mIU/L. BP 118/76 mmHg. SpO2 99%.'
    );
    const status = Object.fromEntries(ex.values.map((v) => [v.key, v.status]));
    assert.equal(status.hemoglobin, 'low');
    assert.equal(status.fasting_glucose, 'high');
    assert.equal(status.total_cholesterol, 'high');
    assert.equal(status.ldl, 'high');
    assert.equal(status.creatinine, 'normal');
    assert.equal(status.platelets, 'normal');
    assert.equal(status.wbc, 'normal');
    assert.equal(status.tsh, 'normal');
    assert.equal(status.systolic_bp, 'normal');
    assert.equal(status.spo2, 'normal');
    assert.equal(ex.values.find((v) => v.key === 'platelets')?.value, 260000);
  });

  test('HbA1c is not mistaken for hemoglobin, and critical values need attention', async () => {
    const { extractClinicalData } = await import('../src/services/ai/clinicalExtractor.js');
    const ex = extractClinicalData('Glycated Hemoglobin (HbA1c): 6.8 %. SpO2 86%. Potassium 6.4 mmol/L');
    assert.equal(ex.values.find((v) => v.key === 'hemoglobin'), undefined);
    assert.equal(ex.values.find((v) => v.key === 'hba1c')?.value, 6.8);
    assert.equal(ex.values.find((v) => v.key === 'spo2')?.severity, 'requires attention');
    assert.equal(ex.values.find((v) => v.key === 'potassium')?.severity, 'requires attention');
  });

  test('keyword scanner catches HIGH / LOW / CRITICAL / (H) flags', async () => {
    const { extractClinicalData } = await import('../src/services/ai/clinicalExtractor.js');
    const ex = extractClinicalData('Ferritin 8 ng/mL LOW\nVitamin D 12 (L)\nTroponin CRITICAL\nESR 45 H');
    assert.deepEqual(ex.keywordFlags.map((f) => f.flag), ['LOW', 'LOW', 'CRITICAL', 'HIGH']);
  });
});

describe('drug checks', () => {
  test('well-known interactions, allergies and brand names are detected', async () => {
    const { checkInteractions } = await import('../src/services/ai/drugKnowledge.js');
    const r = checkInteractions(['Tab. Ecosprin 75mg', 'Warfarin 5mg', 'Sildenafil', 'Isosorbide mononitrate', 'Augmentin 625'], ['Penicillin']);
    const pairs = r.alerts.map((a) => `${a.severity}:${a.drugs.join('+')}`);
    assert.ok(pairs.includes('high:Aspirin+Warfarin'));
    assert.ok(pairs.includes('high:Sildenafil+Nitroglycerin'));
    assert.ok(pairs.includes('high:Amoxicillin-clavulanate'), 'penicillin allergy must be flagged');
  });

  test('safe combinations produce no alerts, unknown names are reported', async () => {
    const { checkInteractions } = await import('../src/services/ai/drugKnowledge.js');
    const r = checkInteractions(['Cetirizine 10mg', 'Salbutamol inhaler', 'Madeupzol']);
    assert.equal(r.alerts.length, 0);
    assert.deepEqual(r.unrecognised, ['Madeupzol']);
  });
});

describe('AI API (built-in engine)', () => {
  test('summary is built from the actual report, never canned text', async () => {
    const t = await tokenFor('doctor@medledger.demo', 'secret99');
    const r = await call('POST', '/api/ai/summarize', { reportText: 'BP 150/96 mmHg. Fasting blood sugar 140 mg/dL. Impression: review sugars.' }, t);
    assert.equal(r.status, 200);
    const d = r.body.data;
    assert.equal(d.engine, 'local');
    assert.match(d.summary, /outside the usual range/);
    assert.ok(d.abnormalValues.some((a: Json) => a.test === 'Fasting Blood Sugar'));
    assert.equal(d.vitalSigns.bloodPressure, '150/96 mmHg');
    assert.equal(d.vitalSigns.heartRate, undefined, 'must not invent vitals that are not in the report');
    assert.equal(d.questionsForDoctor.length, 3);
    assert.match(d.safetyDisclaimer, /informational only/i);
  });

  test('AI endpoints require sign-in and validate input', async () => {
    assert.equal((await call('POST', '/api/ai/summarize', { reportText: 'x' })).status, 401);
    const t = await tokenFor('patient@medledger.demo', 'secret99');
    assert.equal((await call('POST', '/api/ai/drug', { medications: [] }, t)).status, 400);
    assert.equal((await call('POST', '/api/ai/summarize', { reportText: 'x'.repeat(20001) }, t)).status, 400);
  });

  test("a doctor cannot analyse a patient's stored records without consent", async () => {
    const t = await tokenFor('doctor@medledger.demo', 'secret99');
    const r = await call('POST', '/api/ai/chart-synthesis'.replace('/api/ai/', '/api/ai/doctor/'), { patientId: '90' }, t);
    assert.equal(r.status, 403);
    // …but can analyse text they paste in themselves
    assert.equal((await call('POST', '/api/ai/doctor/soap-note', { reportText: 'c/o headache. BP 130/85' }, t)).status, 200);
  });

  test('patient chat answers from their own records', async () => {
    const t = await tokenFor('patient@medledger.demo', 'secret99');
    const r = await call('POST', '/api/ai/chat', { messages: [{ role: 'user', content: 'What was my blood pressure?' }] }, t);
    assert.equal(r.status, 200);
    assert.match(r.body.data.reply, /120\/80/);
    assert.match(r.body.data.reply, /informational only/i);
  });

  test('drug info and interaction endpoints', async () => {
    const t = await tokenFor('patient@medledger.demo', 'secret99');
    const info = await call('POST', '/api/ai/drug-info', { name: 'Dolo 650' }, t);
    assert.equal(info.body.data.name, 'Paracetamol');
    const inter = await call('POST', '/api/ai/drug', { medications: ['sertraline', 'tramadol'] }, t);
    assert.equal(inter.body.data.hasSevereConflict, true);
  });
});

describe('privacy preview endpoint', () => {
  test('shows the de-identified text, per-category counts and a clean re-scan', async () => {
    const t = await tokenFor('doctor@medledger.demo', 'secret99');
    const report = 'Patient Name: Sunita Gurung, Mob: 9856012345, UHID: GCH-004512. Hemoglobin 10.4 g/dL.';
    const r = await call('POST', '/api/ai/deidentify', { reportText: report }, t);
    assert.equal(r.status, 200);
    const d = r.body.data;
    assert.ok(!/Sunita|9856012345|GCH-004512/.test(d.text), d.text);
    assert.ok(d.text.includes('10.4 g/dL'));
    assert.equal(d.safeForExternal, true);
    assert.equal(d.categoryCounts.name, 1);
    assert.equal(d.categoryCounts.phone, 1);
    assert.equal(d.categoryCounts.record_id, 1);
  });

  test('requires sign-in and respects consent for stored records', async () => {
    assert.equal((await call('POST', '/api/ai/deidentify', { reportText: 'x' })).status, 401);
    const t = await tokenFor('doctor@medledger.demo', 'secret99');
    const r = await call('POST', '/api/ai/deidentify', { patientId: 'someone-who-never-consented' }, t);
    assert.equal(r.status, 403);
  });

  test('status reports the privacy gate', async () => {
    const t = await tokenFor('doctor@medledger.demo', 'secret99');
    const r = await call('GET', '/api/ai/status', undefined, t);
    assert.equal(r.body.data.privacy.failClosedGate, true);
    assert.equal(typeof r.body.data.privacy.blocked, 'number');
  });
});

describe('AI API (external model, mocked)', () => {
  test('only de-identified text is sent to the external model', async () => {
    const { aiService } = await import('../src/services/aiService.js');
    const sent: string[] = [];
    aiService.setClient({
      chat: {
        completions: {
          create: async (params: Record<string, any>) => {
            sent.push(JSON.stringify(params.messages));
            return {
              choices: [{ message: { content: JSON.stringify({ summary: 'Your blood sugar is a little high.', keyFindings: [], abnormalValues: [], questionsForDoctor: ['Q1', 'Q2', 'Q3'], recommendations: [] }) } }]
            };
          }
        }
      }
    });
    const t = await tokenFor('doctor@medledger.demo', 'secret99');
    const report = 'Patient: Sita Sharma, Age 45, Phone: 9841234567, email sita@x.com. Fasting blood sugar 140 mg/dL.';
    const r = await call('POST', '/api/ai/summarize', { reportText: report }, t);
    assert.equal(r.status, 200);
    assert.equal(r.body.data.engine, 'openai');
    assert.equal(sent.length, 1);
    for (const pii of ['Sita', '9841234567', 'sita@x.com', 'Age 45']) assert.ok(!sent[0].includes(pii), `"${pii}" was sent to the external AI`);
    assert.ok(sent[0].includes('140 mg/dL'), 'medical values must still be sent');
    // numeric comparator results are kept even though the model returned none
    assert.ok(r.body.data.abnormalValues.some((a: Json) => a.test === 'Fasting Blood Sugar'));
  });

  test('model output is sanitised: names removed, diagnosis language softened, disclaimer added', async () => {
    const { aiService } = await import('../src/services/aiService.js');
    aiService.setClient({
      chat: { completions: { create: async () => ({ choices: [{ message: { content: 'Hello Tanmay Shishodia, you have diabetes. Stop taking the medicine.' } }] }) } }
    });
    const t = await tokenFor('patient@medledger.demo', 'secret99');
    const r = await call('POST', '/api/ai/chat', { messages: [{ role: 'user', content: 'Am I ok?' }] }, t);
    const reply: string = r.body.data.reply;
    assert.ok(!/tanmay/i.test(reply), reply);
    assert.ok(!/you have diabetes/i.test(reply), reply);
    assert.ok(!/stop taking/i.test(reply), reply);
    assert.match(reply, /informational only/i);
  });

  test('falls back to the built-in engine when the external model fails', async () => {
    const { aiService } = await import('../src/services/aiService.js');
    aiService.setClient({ chat: { completions: { create: async () => { throw new Error('timeout'); } } } });
    const t = await tokenFor('doctor@medledger.demo', 'secret99');
    const r = await call('POST', '/api/ai/summarize', { reportText: 'Hemoglobin 9.0 g/dL' }, t);
    assert.equal(r.status, 200);
    assert.equal(r.body.data.engine, 'local');
    assert.ok(r.body.data.abnormalValues.length === 1);
  });
});
