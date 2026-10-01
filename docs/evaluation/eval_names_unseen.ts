/**
 * Phase 9 – names in phrasings the synthetic generator never writes (written by hand, not tuned on).
 * Shows how far the de-identifier generalises beyond the templates. Run from apps/server:
 *   node --import tsx ../../docs/evaluation/eval_names_unseen.ts
 */
import fs from 'fs';
import path from 'path';
import { deidentify } from '../../apps/server/src/services/ai/deidentify.js';

// Set A was written first and then used to find the gaps (so it is no longer unseen).
// Set B was written before those fixes and never used to change the code: it is the honest number.
const SET_A: Array<[string, string[]]> = [
  ["Her son, Rupesh, will collect the report on Friday.", ['Rupesh']],
  ["Patient's mother Bhagwati Luitel was present during the visit.", ['Bhagwati', 'Luitel']],
  ['Contact person: Janak Timsina (brother).', ['Janak', 'Timsina']],
  ['Nurse on duty: Kopila Wagle', ['Kopila', 'Wagle']],
  ['Brought in by neighbour Hikmat Kandel after a fall.', ['Hikmat', 'Kandel']],
  ['Ref. physician: Dr. Aayusha Humagain', ['Aayusha', 'Humagain']],
  ['Phlebotomist - Yubraj Devkota', ['Yubraj', 'Devkota']],
  ['Lab technologist Samjhana Aryal verified the sample.', ['Samjhana', 'Aryal']],
  ['The report was handed to Pratiksha Baral, the patient’s daughter.', ['Pratiksha', 'Baral']],
  ['Husband (Dilliram Rijal) consented on her behalf.', ['Dilliram', 'Rijal']],
  ['Tulasa Bhusal, 34, attended for follow-up.', ['Tulasa', 'Bhusal']],
  ['Spoke with Ujjwal on the phone about the results.', ['Ujjwal']],
  ['पिताको नाम: जनक तिमल्सिना', ['जनक', 'तिमल्सिना']],
  ['बुवा: हिक्मत कँडेल', ['हिक्मत', 'कँडेल']],
  ['डा. आयुषा हुमागाईं द्वारा जाँच गरिएको', ['आयुषा', 'हुमागाईं']],
  ['Emergency contact: Nirmala Dhungana, +977 9812345678', ['Nirmala', 'Dhungana']],
  ['Seen with her daughter-in-law Sushmita Lamichhane.', ['Sushmita', 'Lamichhane']],
  ['Reviewed jointly with Dr Bijaya Luitel (cardiology).', ['Bijaya', 'Luitel']],
  ['Case of Mr Hikmat Wagle, referred from district hospital.', ['Hikmat', 'Wagle']],
  ['Report prepared by: Rupesh Timsina, MLT', ['Rupesh', 'Timsina']]
];
const SET_B: Array<[string, string[]]> = [
  ['Her elder brother Janak Wagle is the emergency contact.', ['Janak', 'Wagle']],
  ['Details confirmed by the patient’s wife, Nirmala Kandel.', ['Nirmala', 'Kandel']],
  ['Ward sister: Bhagwati Timsina', ['Bhagwati', 'Timsina']],
  ['Escort: Yubraj Humagain (nephew)', ['Yubraj', 'Humagain']],
  ['Blood drawn at home by Aayusha Baral, lab assistant.', ['Aayusha', 'Baral']],
  ['Hikmat Dhungana, aged 58, presented with chest pain.', ['Hikmat', 'Dhungana']],
  ['I have explained the findings to Kopila.', ['Kopila']],
  ['Second opinion from Dr. Samjhana Devkota, nephrologist.', ['Samjhana', 'Devkota']],
  ['Daughter Pratiksha Aryal will bring the old reports.', ['Pratiksha', 'Aryal']],
  ['Relative: Dilliram Luitel, phone 9841234567', ['Dilliram', 'Luitel']],
  ['Verified by lab in-charge Tulasa Rijal.', ['Tulasa', 'Rijal']],
  ['The patient lives with her grandson Ujjwal Bhusal.', ['Ujjwal', 'Bhusal']],
  ['आमा: भगवती लुइटेल', ['भगवती', 'लुइटेल']],
  ['सम्पर्क व्यक्ति: युवराज बराल', ['युवराज', 'बराल']],
  ['श्री दिल्लीराम रिजाल', ['दिल्लीराम', 'रिजाल']],
  ['Typed by: Sushmita Wagle', ['Sushmita', 'Wagle']],
  ['Mother (Janaki Timsina) reports poor appetite.', ['Janaki', 'Timsina']],
  ['Counselled together with his son Bijaya.', ['Bijaya']],
  ['Attending nurse Rupesh Kandel noted the vitals.', ['Rupesh', 'Kandel']],
  ['Collected from Humagain residence by Yubraj.', ['Humagain', 'Yubraj']]
];
const leaked = (out: string, w: string) =>
  /[\u0900-\u097F]/.test(w) ? new RegExp(`(?<![\\p{L}\\p{M}])${w}(?![\\p{L}\\p{M}])`, 'u').test(out) : new RegExp(`\\b${w}\\b`).test(out);
const run = (cases: Array<[string, string[]]>) => {
  let names = 0, removed = 0;
  const misses: string[] = [];
  for (const [text, ws] of cases) {
    const out = deidentify(text, []).text;
    for (const w of ws) { names++; if (!leaked(out, w)) removed++; else misses.push(`${w} ← ${out}`); }
  }
  return { sentences: cases.length, nameWords: names, removed, recall: removed / names, misses };
};
const result = { setA_usedForFixes: run(SET_A), setB_heldOut: run(SET_B) };
fs.writeFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), 'results', process.env.NAMES_OUT || 'names_unseen.json'), JSON.stringify(result, null, 1));
for (const [k, r] of Object.entries(result)) {
  console.log(`${k}: ${r.removed}/${r.nameWords} name words removed (${((100 * r.removed) / r.nameWords).toFixed(1)}%)`);
  if (process.env.SHOW_MISSES === k) for (const m of r.misses) console.log('  miss:', m);
}
