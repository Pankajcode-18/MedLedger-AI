/**
 * De-identification tests (Project Guide §7.2 / §11.3).
 * Covers every identifier category, false-positive guards on real clinical text,
 * the independent re-scan, and the fail-closed gate in front of the external model.
 * Run with: npm test (inside apps/server).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = '';

const load = () => import('../src/services/ai/deidentify.js');

/** [input, identifiers that must disappear, text that must survive, expected category] */
const CATEGORY_CASES: Array<[string, string[], string[], string]> = [
  ['Visit https://portal.example.com/p/881 for results', ['portal.example.com'], ['for results'], 'url'],
  ['Login from 192.168.1.20 recorded', ['192.168.1.20'], ['recorded'], 'ip_address'],
  ['Citizenship No: 27-01-72-12345', ['27-01-72-12345'], ['Citizenship No'], 'national_id'],
  ['Cert 27-01-72-12345 verified', ['27-01-72-12345'], ['verified'], 'national_id'],
  ['NID 1234 5678 90 on file', ['1234 5678 90'], ['on file'], 'national_id'],
  ['ABHA 12-3456-7890-1234.', ['3456-7890-1234'], ['ABHA'], 'national_id'],
  ['Passport: PA1234567', ['PA1234567'], ['Passport'], 'national_id'],
  ['Voter ID: ABC1234567', ['ABC1234567'], ['Voter ID'], 'national_id'],
  ['Card 4111 1111 1111 1111.', ['4111 1111 1111 1111', '1111.'], ['Card'], 'payment_card'],
  ['Paid with 4111111111111111 today', ['4111111111111111'], ['today'], 'payment_card'],
  ['IFSC SBIN0001234, A/c No. 0123456789012', ['SBIN0001234', '0123456789012'], ['IFSC'], 'bank_account'],
  ['Vehicle No: BA 2 PA 1234', ['BA 2 PA 1234'], ['Vehicle No'], 'vehicle'],
  ['IMEI: 356938035643809', ['356938035643809'], ['IMEI'], 'device_id'],
  ['Seen on 5th March 2024 and 12-Jan-2024', ['March 2024', 'Jan-2024'], ['Seen on'], 'date'],
  ['Follow-up June 2025; earlier 03/04/25', ['June 2025', '03/04/25'], ['Follow-up'], 'date'],
  ['Collected on 2024-05-11 at 9 am', ['2024-05-11'], ['at 9 am'], 'date'],
  ['S/o Hari Bahadur Karki, age unknown', ['Hari', 'Karki'], ['age unknown'], 'name'],
  ['Dear Sita, your report is ready', ['Sita'], ['your report is ready'], 'name'],
  ["Father's Name: Krishna Prasad", ['Krishna'], ["Father's Name"], 'name'],
  ['Resident of Baneshwor, Kathmandu. Fever 3 days.', ['Baneshwor', 'Kathmandu'], ['Fever 3 days'], 'address'],
  ['Lives at 12 MG Road near park', ['12 MG Road'], ['near park'], 'address'],
  ['PIN 44600', ['44600'], ['PIN'], 'address'],
  ['Collected at: Grande City Hospital', ['Grande'], ['Collected at'], 'facility'],
  ['Admitted to Norvic International Hospital yesterday', ['Norvic'], ['yesterday'], 'facility'],
  ['Verified by Dr. Anjali Rai', ['Anjali'], ['Verified by'], 'clinician_name'],
  ['Mail me at sita.sharma@gmail.com', ['sita.sharma@gmail.com'], ['Mail me at'], 'email'],
  ['Landline 01-4412345.', ['4412345'], ['Landline'], 'phone'],
  ['Call 9841234567.', ['9841234567'], ['Call'], 'phone']
];

/** Real clinical text that must come out unchanged. */
const CLINICAL_TEXT = [
  'Hb 13.5 g/dL, Platelets 2.5 lakh/cumm, RBC 4500000 /uL, WBC 7800 /cumm, ESR 22 mm/hr',
  'BP 120/80 mmHg, Pulse 72 bpm, SpO2 98%, Temp 98.6 F, RR 18/min',
  'HbA1c 6.1 %, FBS 102 mg/dL, TSH 4.5 mIU/L, Vitamin D 18 ng/mL, B12 190 pg/mL',
  'Tab Metformin 500 mg BD x 30 days. Tab Telma 40 mg OD. Inj Insulin 10 units.',
  'Stage 2 hypertension. Macrocytic anemia. Serial measurements advised.',
  'Encounter with patient was brief. Take care of wound. Born at term.',
  'Clinical Pathology Report. Routine Labs normal. MRI imaging planned. Road traffic accident in 2019.',
  'Patient presents with fever since May. Test Name: Hemoglobin. Drug Name: Aspirin.',
  'Values: 12 14 16 18 20 22 24 26 28 30 32 34 mg across visits',
  'Machine learning is not used here; macrophages seen. Agent orange exposure denied.',
  'Creatinine 1.8 mg/dL (H). eGFR 48 mL/min/1.73m2. Uric acid 7.9 mg/dL.'
];

describe('de-identification: identifier categories', () => {
  for (const [input, gone, kept, category] of CATEGORY_CASES) {
    test(`${category}: ${input}`, async () => {
      const { deidentify } = await load();
      const r = deidentify(input);
      for (const g of gone) assert.ok(!r.text.includes(g), `"${g}" leaked → ${r.text}`);
      for (const k of kept) assert.ok(r.text.includes(k), `"${k}" was removed → ${r.text}`);
      assert.ok(r.categoryCounts[category] >= 1, `expected category ${category}, got ${JSON.stringify(r.categoryCounts)}`);
    });
  }
});

describe('de-identification: known people', () => {
  test('names are removed in file names, other scripts, and with middle names in between', async () => {
    const { deidentify } = await load();
    const names = ['Ram Thapa', 'रमेश शर्मा', 'Dr. Anil Sharma, M.D.'];
    const r = deidentify('File: Ram_Thapa_CBC.pdf. Name: Ram Bahadur Thapa. रमेश शर्मा का रिपोर्ट. Seen by Anil Sharma.', names);
    for (const g of ['Ram_', 'Thapa', 'Bahadur', 'रमेश', 'Anil', 'Sharma']) assert.ok(!r.text.includes(g), `"${g}" leaked → ${r.text}`);
    assert.ok(r.text.includes('CBC.pdf'));
  });

  test('common middle names alone are not treated as a person', async () => {
    const { deidentify } = await load();
    const r = deidentify('Kumar scale score 3', ['Anil Kumar Shah']);
    assert.equal(r.text, 'Kumar scale score 3');
  });
});

describe('de-identification: no over-redaction', () => {
  test('clinical text is left unchanged', async () => {
    const { deidentify } = await load();
    for (const line of CLINICAL_TEXT) assert.equal(deidentify(line).text, line);
  });

  test('a full report keeps every medical value while losing every identifier', async () => {
    const { deidentify, scanForPII } = await load();
    const report = [
      'Grande City Hospital, Kathmandu | www.grandehospital.com',
      'Patient Name: Sunita Gurung   Age/Sex: 34 Y/F   UHID: GCH-004512',
      'W/o Bikash Gurung, Resident of Pokhara, Kaski. Mob: +977-9856012345',
      'Collected: 11/05/2024 08:30   Reported: 12 May 2024',
      'Referred by: Dr. Nabin Shrestha',
      'Hemoglobin 10.4 g/dL (L)  12.0-15.5',
      'Fasting Blood Sugar 128 mg/dL (H)',
      'TSH 6.8 mIU/L (H)',
      'Verified by: Dr. Kamala Joshi, MD Pathology (NMC 12345)'
    ].join('\n');
    const r = deidentify(report);
    for (const g of ['Grande', 'grandehospital', 'Sunita', 'Gurung', 'GCH-004512', 'Bikash', 'Pokhara', '9856012345', '11/05/2024', '12 May 2024', 'Nabin', 'Kamala', '12345)']) {
      assert.ok(!r.text.includes(g), `"${g}" leaked →\n${r.text}`);
    }
    for (const k of ['10.4 g/dL', '128 mg/dL', '6.8 mIU/L', '12.0-15.5', '(H)', '(L)']) assert.ok(r.text.includes(k), `"${k}" removed →\n${r.text}`);
    assert.deepEqual(scanForPII(r.text), []);
    assert.ok(r.redactions >= 10);
    // counts are reported per category and contain no values
    assert.ok(Object.values(r.categoryCounts).every((n) => typeof n === 'number'));
  });

  test('nested values (lab result objects) are de-identified too', async () => {
    const { deidentifyValue } = await load();
    const out = deidentifyValue({ patient: 'Name: Sita Rai', results: [{ test: 'Hb', value: '11 g/dL', note: 'call 9841234567' }] });
    assert.equal(out.results[0].value, '11 g/dL');
    assert.ok(!JSON.stringify(out).includes('Sita'));
    assert.ok(!JSON.stringify(out).includes('9841234567'));
  });
});

describe('fail-closed privacy gate', () => {
  test('the independent scanner finds identifiers and ignores lab values', async () => {
    const { scanForPII } = await load();
    const found = scanForPII('mail a@b.com, phone 9841234567, card 4111111111111111, on 2024-05-01', ['Sita Rai']);
    assert.deepEqual(found.map((f) => f.category).sort(), ['date', 'email', 'payment_card', 'phone']);
    assert.deepEqual(scanForPII('RBC 4500000 /uL, BP 120/80, HbA1c 6.1 %'), []);
    assert.deepEqual(scanForPII('Sita Rai called', ['Sita Rai']).map((f) => f.category), ['name']);
  });

  test('an external call carrying an identifier is blocked and never reaches the model', async () => {
    const { aiService } = await import('../src/services/aiService.js');
    let calls = 0;
    aiService.setClient({ chat: { completions: { create: async () => { calls++; return { choices: [{ message: { content: '{}' } }] }; } } } });
    const before = aiService.privacyStats.blocked;
    const internals = aiService as unknown as { askJson: (s: string, u: string) => Promise<unknown>; askText: (m: Array<{ role: string; content: string }>) => Promise<unknown> };
    assert.equal(await internals.askJson('system', 'please call 9841234567'), null);
    assert.equal(await internals.askText([{ role: 'user', content: 'my email is x@y.com' }]), null);
    assert.equal(calls, 0, 'nothing may be sent when the gate finds an identifier');
    assert.equal(aiService.privacyStats.blocked, before + 2);
    // clean text goes through
    await internals.askJson('system', 'Hemoglobin 9.0 g/dL');
    assert.equal(calls, 1);
    aiService.setClient(null);
  });
});
