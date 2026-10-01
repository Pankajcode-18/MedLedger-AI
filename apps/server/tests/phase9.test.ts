/**
 * Phase 9 – AI accuracy:
 *  - sex-specific ranges, the report's own printed range first, and SI units converted
 *  - names found without a registered name: labels, cue phrases, common names and Devanagari
 * Run with: npm test (inside apps/server).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractClinicalData } from '../src/services/ai/clinicalExtractor.js';
import { deidentify } from '../src/services/ai/deidentify.js';

const value = (text: string, key: string) => extractClinicalData(text).values.find((v) => v.key === key);

describe('reference ranges', () => {
  test('haemoglobin, creatinine, uric acid and HDL use the patient’s sex', () => {
    assert.equal(value('Age/Sex: 40/F\nHemoglobin: 12.5 g/dL', 'hemoglobin')?.status, 'normal');
    assert.equal(value('Age/Sex: 40/M\nHemoglobin: 12.5 g/dL', 'hemoglobin')?.status, 'low');
    assert.equal(value('Age/Sex: 40/F\nUric acid: 6.5 mg/dL', 'uric_acid')?.status, 'high');
    assert.equal(value('Age/Sex: 40/M\nUric acid: 6.5 mg/dL', 'uric_acid')?.status, 'normal');
    assert.equal(value('Age/Sex: 40/F\nHDL cholesterol: 45 mg/dL', 'hdl')?.status, 'low');
    assert.equal(value('Age/Sex: 40/M\nHDL cholesterol: 45 mg/dL', 'hdl')?.status, 'normal');
  });

  test('the range printed on the report is preferred to the built-in one', () => {
    const hb = value('Age/Sex: 40/M\nHb 13.2 g/dL (Ref: 11.2 - 16.3)', 'hemoglobin')!;
    assert.equal(hb.status, 'normal', 'the laboratory’s own range says normal');
    assert.equal(hb.rangeSource, 'report');
    assert.match(hb.referenceRange, /from the report/);
    assert.equal(value('LDL cholesterol 125 mg/dL (Ref: < 125)', 'ldl')?.status, 'high', '"< 125" means 125 is already high');
    assert.equal(value('HDL cholesterol 50 mg/dL (Ref: > 52.7)', 'hdl')?.status, 'low');
  });

  test('a printed range far from the usual one (a misread) is ignored', () => {
    const hb = value('Age/Sex: 40/M\nHb 13.2 g/dL (Ref: 1.2 - 1.6)', 'hemoglobin')!;
    assert.equal(hb.rangeSource, undefined);
    assert.equal(hb.status, 'low', 'falls back to the built-in male range');
  });

  test('SI units are converted before the value is judged, and the original is shown', () => {
    const glu = value('Fasting blood sugar: 7.2 mmol/L', 'fasting_glucose')!;
    assert.ok(Math.abs(glu.value - 129.7) < 0.1, String(glu.value));
    assert.equal(glu.status, 'high');
    assert.match(glu.display, /7\.2 mmol\/L/);
    const cr = value('Age/Sex: 60/M\nCreatinine: 150 µmol/L', 'creatinine')!;
    assert.ok(Math.abs(cr.value - 1.7) < 0.01, String(cr.value));
    assert.equal(cr.status, 'high');
    assert.equal(value('Hemoglobin: 128 g/L', 'hemoglobin')?.value, 12.8);
  });

  test('a child’s report carries a note that adult ranges were used', () => {
    assert.match(extractClinicalData('Age/Sex: 9/M\nHemoglobin: 11.0 g/dL').rangeNote ?? '', /under 18/);
    assert.equal(extractClinicalData('Age/Sex: 45/M\nHemoglobin: 11.0 g/dL').rangeNote, undefined);
  });
});

describe('names without a registered name', () => {
  const clean = (text: string) => deidentify(text, []).text;

  test('a name the report labels is removed everywhere else in it', () => {
    const out = clean('Patient Name: Ujjwal Luitel    Age/Sex: 40/M\nImpression: Ujjwal is a 40-year-old man; findings discussed.');
    assert.ok(!/Ujjwal|Luitel/.test(out), out);
    assert.match(out, /40-year-old/);
  });

  test('relatives, a second clinician and a sample collector are found from cue phrases', () => {
    for (const [text, name] of [
      ['Accompanied by her husband Hikmat Timsina, who gave the history.', 'Timsina'],
      ['Result explained to his sister, Kopila Wagle.', 'Wagle'],
      ['Sample collected by Yubraj Kandel at 8:15 am.', 'Kandel'],
      ['Case discussed with Dr. Tulasa Humagain.', 'Humagain'],
      ['Informant: Janak Baral (son).', 'Baral'],
      ['Mrs. Samjhana Rijal called to ask about the results.', 'Rijal']
    ]) {
      const out = clean(text);
      assert.ok(!out.includes(name), `${text} → ${out}`);
    }
  });

  test('two capitalised words with a common Nepali or Indian name are removed', () => {
    assert.equal(clean('Findings shared with Sita Tamang today.'), 'Findings shared with [NAME] today.');
  });

  test('names in Devanagari after a label or an honorific', () => {
    assert.equal(clean('नाम: सीता तामाङ'), 'नाम: [NAME]');
    assert.equal(clean('बिरामीको नाम: राम अय्यर'), 'बिरामीको नाम: [NAME]');
    assert.ok(!clean('श्रीमती गीता शर्मा आउनुभयो').includes('गीता'));
  });

  test('clinical text with capitalised words is left alone', () => {
    for (const t of ['Complete Blood Count normal.', 'Asha Worker visit planned.', 'Durga Puja holiday, review after.', 'Test Name: Hemoglobin. Drug Name: Aspirin.', 'Vitamin D Total 19 ng/mL.', 'Nurse Practitioner review advised.', 'Lab Assistant: Hemoglobin rechecked.', 'Mother Tongue: Nepali', 'Relative Risk Reduction 20%', 'Spoke with Cardiology Team.', 'Partner Notification done.']) {
      assert.equal(clean(t), t);
    }
  });
});
