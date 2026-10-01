/**
 * Synthetic, reproducible evaluation data for MedLedger AI (no real patient data).
 * Reports mix labelled headers, narrative text and four lab-value layouts; every personal
 * detail and every lab value is recorded as ground truth.
 */
import { LAB_TESTS, rangeFor } from '../../apps/server/src/services/ai/labReference.js';

// mulberry32: small seeded PRNG so every run produces the same data
export const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const FIRST = ['Sita', 'Ram', 'Hari', 'Gita', 'Anjali', 'Bikash', 'Sunita', 'Rajesh', 'Priya', 'Arjun', 'Kabita', 'Suresh', 'Meena', 'Dipesh', 'Asha', 'Nabin', 'Pooja', 'Rohan', 'Laxmi', 'Kiran', 'Sabina', 'Manoj', 'Rekha', 'Amit', 'Nisha', 'Prakash', 'Sarita', 'Vikram', 'Deepa', 'Sanjay'];
const LAST = ['Sharma', 'Thapa', 'Gurung', 'Shrestha', 'Adhikari', 'Karki', 'Poudel', 'Rai', 'Tamang', 'Magar', 'Joshi', 'Bhattarai', 'Khadka', 'Verma', 'Singh', 'Patel', 'Iyer', 'Reddy', 'Nair', 'Das', 'Yadav', 'Chaudhary', 'Basnet', 'Lama', 'Pandey'];
// Hard set: names deliberately NOT in the de-identifier's list of common names, so detection must come from context
const RARE_FIRST = ['Ujjwal', 'Pratiksha', 'Samjhana', 'Bijaya', 'Rupesh', 'Nirmala', 'Tulasa', 'Yubraj', 'Kopila', 'Dilliram', 'Sushmita', 'Janak', 'Bhagwati', 'Hikmat', 'Aayusha'];
const RARE_LAST = ['Bhusal', 'Dahal', 'Ghimire', 'Neupane', 'Sapkota', 'Luitel', 'Khanal', 'Rijal', 'Dhungana', 'Lamichhane', 'Aryal', 'Baral'];
// Devanagari spellings used for the names the hard set writes in Nepali
const DEVANAGARI: Record<string, string> = {
  Sita: 'सीता', Ram: 'राम', Hari: 'हरि', Gita: 'गीता', Anjali: 'अञ्जली', Bikash: 'विकास', Sunita: 'सुनिता', Rajesh: 'राजेश', Priya: 'प्रिया', Arjun: 'अर्जुन',
  Kabita: 'कविता', Suresh: 'सुरेश', Meena: 'मीना', Dipesh: 'दिपेश', Asha: 'आशा', Nabin: 'नवीन', Pooja: 'पूजा', Rohan: 'रोहन', Laxmi: 'लक्ष्मी', Kiran: 'किरण',
  Sabina: 'सबिना', Manoj: 'मनोज', Rekha: 'रेखा', Amit: 'अमित', Nisha: 'निशा', Prakash: 'प्रकाश', Sarita: 'सरिता', Vikram: 'विक्रम', Deepa: 'दीपा', Sanjay: 'सञ्जय',
  Sharma: 'शर्मा', Thapa: 'थापा', Gurung: 'गुरुङ', Shrestha: 'श्रेष्ठ', Adhikari: 'अधिकारी', Karki: 'कार्की', Poudel: 'पौडेल', Rai: 'राई', Tamang: 'तामाङ', Magar: 'मगर',
  Joshi: 'जोशी', Bhattarai: 'भट्टराई', Khadka: 'खड्का', Verma: 'वर्मा', Singh: 'सिंह', Patel: 'पटेल', Iyer: 'अय्यर', Reddy: 'रेड्डी', Nair: 'नायर', Das: 'दास',
  Yadav: 'यादव', Chaudhary: 'चौधरी', Basnet: 'बस्नेत', Lama: 'लामा', Pandey: 'पाण्डे'
};
const RELATIONS = ['son', 'daughter', 'husband', 'wife', 'mother', 'father', 'brother', 'sister'];
const PLACES = ['Baneshwor', 'Lalitpur', 'Pokhara', 'Bharatpur', 'Biratnagar', 'Dharan', 'Butwal', 'Coimbatore', 'Madurai', 'Patna', 'Lucknow', 'Chitwan', 'Hetauda', 'Janakpur', 'Kirtipur'];
const STREETS = ['Ring Road', 'Durbar Marg', 'Gandhi Nagar', 'Lakeside Road', 'Station Road', 'Main Bazaar', 'New Colony', 'Tinkune Chowk'];
const FACILITIES = ['Himal Care Hospital', 'City Diagnostic Lab', 'Everest Medical Centre', 'Sagarmatha Diagnostics', 'Lumbini Teaching Hospital', 'Kaveri Diagnostic Centre'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Human spellings people actually write for each test (label, then common short forms)
export const NAMES: Record<string, string[]> = {
  heart_rate: ['Pulse', 'Heart rate', 'HR'], spo2: ['SpO2', 'Oxygen saturation'], temperature: ['Temperature', 'Temp'],
  resp_rate: ['Respiratory rate', 'RR'], hemoglobin: ['Hemoglobin', 'Haemoglobin', 'Hb'], wbc: ['WBC', 'Total leucocyte count', 'TLC'],
  platelets: ['Platelet count', 'Platelets', 'PLT'], rbc: ['RBC count', 'Red blood cells'], hematocrit: ['Hematocrit', 'PCV'],
  esr: ['ESR'], fasting_glucose: ['Fasting blood sugar', 'FBS', 'Fasting glucose'], hba1c: ['HbA1c', 'Glycated haemoglobin'],
  total_cholesterol: ['Total cholesterol'], ldl: ['LDL cholesterol', 'LDL'], hdl: ['HDL cholesterol', 'HDL'], triglycerides: ['Triglycerides', 'TG'],
  creatinine: ['Serum creatinine', 'Creatinine'], urea: ['BUN', 'Blood urea nitrogen'], uric_acid: ['Uric acid'], sodium: ['Sodium'],
  potassium: ['Potassium'], calcium: ['Serum calcium', 'Calcium'], alt: ['SGPT', 'ALT'], ast: ['SGOT', 'AST'], bilirubin: ['Total bilirubin', 'Bilirubin'],
  tsh: ['TSH'], vitamin_d: ['Vitamin D'], vitamin_b12: ['Vitamin B12']
};

export type Pii = {
  type: 'name' | 'phone' | 'email' | 'date' | 'address' | 'national_id' | 'facility' | 'clinician' | 'relative';
  value: string;
  context: 'labelled' | 'narrative';
  /** Hard set: written in Devanagari, and whether the name is outside the de-identifier's name list. */
  script?: 'devanagari';
  rareName?: boolean;
};
export type Lab = {
  key: string;
  /** In the reference table's unit (converted when the report used another unit). */
  value: number;
  status: 'normal' | 'low' | 'high';
  format: 'colon' | 'inline-ref' | 'table' | 'dash';
  /** Unit written in the report when it is not the reference table's (hard set). */
  unit?: string;
  /** Where the status comes from: the range printed on the report, or the sex-specific built-in range. */
  range: 'printed' | 'built-in';
};
export type Report = { id: number; text: string; patientName: string; pii: Pii[]; labs: Lab[]; bp?: { sys: number; dia: number } };

const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];
const digits = (r: () => number, n: number) => Array.from({ length: n }, () => Math.floor(r() * 10)).join('');
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/** A value around the (unknown-sex) range; its status is decided later against the range that applies. */
function labValue(r: () => number, key: string, nearBound = 0): number | null {
  const test = LAB_TESTS.find((t) => t.key === key)!;
  const { low, high } = rangeFor(test, 'unknown');
  const choices: Lab['status'][] = ['normal'];
  if (low !== undefined) choices.push('low');
  // no "high" when the normal range already reaches what is physically possible (SpO2 above 100 % cannot occur)
  if (high !== undefined && !(test.limits && high >= test.limits[1])) choices.push('high');
  const status = pick(r, choices);
  const lo = low ?? (high !== undefined ? high * 0.4 : 1);
  const hi = high ?? lo * 2.5;
  const span = hi - lo;
  let v: number;
  if (nearBound && r() < nearBound) {
    // hard set: close to a limit (within ±4 %), where rounding and the choice of range matter most
    const b = pick(r, [low, high].filter((x): x is number => x !== undefined));
    v = b * (1 + (r() * 0.08 - 0.04));
  } else if (status === 'normal') v = lo + span * (0.1 + 0.8 * r());
  // clinically plausible deviations: a fraction of the normal span below or above it
  else if (status === 'low') v = lo - Math.min(span * (0.1 + 0.9 * r()), lo * 0.6);
  else v = hi + span * (0.1 + 1.5 * r());
  if (v <= 0) return null;
  if (test.limits) v = Math.min(Math.max(v, test.limits[0]), test.limits[1]);
  const dec = hi >= 1000 ? 0 : hi >= 100 ? 0 : hi >= 10 ? 1 : 2;
  return round(v, dec);
}

/** The status a laboratory would report: against the printed range when there is one, else the sex-specific range. */
const statusOf = (v: number, low?: number, high?: number): Lab['status'] => (high !== undefined && v > high ? 'high' : low !== undefined && v < low ? 'low' : 'normal');

/** Printed like a laboratory prints it ("< 200" means 200 and above is high). */
const printRange = (low?: number, high?: number): { text: string; low?: number; high?: number } => {
  if (low !== undefined && high !== undefined) return { text: `${low} - ${high}`, low, high };
  if (high !== undefined) {
    const cut = Number.isInteger(high) ? high + 1 : round(high + 0.01, 2);
    return { text: `< ${cut}`, high: Number.isInteger(high) ? high : round(cut - 0.01, 2) };
  }
  return { text: `> ${low}`, low };
};

const fmtNum = (v: number) => (v >= 10000 ? v.toLocaleString('en-US') : String(v));

export interface DatasetOptions {
  /**
   * Harder reports: laboratory-specific printed ranges, values near the limits, SI units, relatives,
   * a second clinician, a sample collector and names written in Devanagari.
   */
  hard?: boolean;
}

export function makeReport(id: number, r: () => number, opts: DatasetOptions = {}): Report {
  const first = pick(r, FIRST), last = pick(r, LAST);
  const name = `${first} ${last}`;
  const doc = `${pick(r, FIRST)} ${pick(r, LAST)}`;
  const facility = pick(r, FACILITIES);
  const phone = pick(r, [`+977 98${digits(r, 8)}`, `+91 ${digits(r, 5)} ${digits(r, 5)}`, `98${digits(r, 8)}`, `0${1 + Math.floor(r() * 9)}-${digits(r, 7)}`]);
  const email = `${first.toLowerCase()}.${last.toLowerCase()}${digits(r, 2)}@${pick(r, ['gmail.com', 'yahoo.com', 'outlook.com'])}`;
  const d = 1 + Math.floor(r() * 28), mo = Math.floor(r() * 12), y = 1950 + Math.floor(r() * 55);
  const dob = pick(r, [`${String(d).padStart(2, '0')}/${String(mo + 1).padStart(2, '0')}/${y}`, `${d} ${MONTHS[mo]} ${y}`, `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`]);
  const visit = `${1 + Math.floor(r() * 28)}/${1 + Math.floor(r() * 12)}/2026`;
  const street = `${1 + Math.floor(r() * 200)} ${pick(r, STREETS)}`;
  const place = pick(r, PLACES);
  const id_ = pick(r, [`${digits(r, 4)} ${digits(r, 4)} ${digits(r, 4)}`, `${digits(r, 2)}-${digits(r, 2)}-${digits(r, 2)}-${digits(r, 5)}`]);
  const age = 18 + Math.floor(r() * 70);
  const sex = pick(r, ['M', 'F']);
  const sexKey = sex === 'M' ? 'male' : 'female';

  const pii: Pii[] = [];
  const lines: string[] = [];
  lines.push(facility.toUpperCase().includes('LAB') ? facility : facility);
  pii.push({ type: 'facility', value: facility, context: 'labelled' });
  lines.push(`Patient Name: ${name}    Age/Sex: ${age}/${sex}`);
  pii.push({ type: 'name', value: name, context: 'labelled' });
  lines.push(`DOB: ${dob}    Phone: ${phone}`);
  pii.push({ type: 'date', value: dob, context: 'labelled' }, { type: 'phone', value: phone, context: 'labelled' });
  lines.push(`Address: ${street}, ${place}`);
  pii.push({ type: 'address', value: street, context: 'labelled' });
  if (r() < 0.6) {
    lines.push(`ID No: ${id_}`);
    pii.push({ type: 'national_id', value: id_, context: 'labelled' });
  }
  if (r() < 0.6) {
    lines.push(`Email: ${email}`);
    pii.push({ type: 'email', value: email, context: 'labelled' });
  }
  lines.push(`Referred by: Dr. ${doc}    Collected: ${visit}`);
  pii.push({ type: 'clinician', value: doc, context: 'labelled' }, { type: 'date', value: visit, context: 'labelled' });

  // hard set: the patient's name also in Devanagari, and a second clinician in the header
  const doc2 = opts.hard ? `${pick(r, [...FIRST, ...RARE_FIRST])} ${pick(r, [...LAST, ...RARE_LAST])}` : '';
  if (opts.hard) {
    if (r() < 0.4) {
      const dev = `${DEVANAGARI[first]} ${DEVANAGARI[last]}`;
      lines.push(`${pick(r, ['नाम', 'बिरामीको नाम'])}: ${dev}`);
      pii.push({ type: 'name', value: dev, context: 'labelled', script: 'devanagari' });
    }
    if (r() < 0.5) {
      lines.push(`Consultant pathologist: Dr. ${doc2}`);
      pii.push({ type: 'clinician', value: doc2, context: 'labelled', rareName: RARE_FIRST.some((n) => doc2.startsWith(n)) || RARE_LAST.some((n) => doc2.endsWith(n)) });
    }
  }
  lines.push('');

  // lab section: 4-9 tests, one layout per report
  const format = pick(r, ['colon', 'inline-ref', 'table', 'dash'] as Lab['format'][]);
  const printsRange = format === 'inline-ref' || format === 'table';
  const siReport = opts.hard && r() < 0.3;
  const keys = Object.keys(NAMES);
  const chosen = new Set<string>();
  const n = 4 + Math.floor(r() * 6);
  while (chosen.size < n) chosen.add(pick(r, keys));
  const labs: Lab[] = [];
  if (format === 'table') lines.push('Test                     Result      Unit         Reference');
  for (const key of chosen) {
    const t = LAB_TESTS.find((x) => x.key === key)!;
    const v0 = labValue(r, key, opts.hard ? 0.3 : 0);
    if (v0 === null) continue;
    const label = pick(r, NAMES[key]);
    // the range a laboratory prints: the standard set prints the sex-neutral range; the hard set prints the
    // patient's sex-specific range, shifted by up to ±8 % as laboratories' own ranges differ
    let { low, high } = rangeFor(t, opts.hard ? sexKey : 'unknown');
    if (opts.hard && printsRange) {
      const shift = (x?: number) => (x === undefined ? x : round(x * (1 + (r() * 0.16 - 0.08)), x >= 100 ? 0 : x >= 10 ? 1 : 2));
      low = shift(low);
      high = shift(high);
      if (low !== undefined && high !== undefined && low >= high) ({ low, high } = rangeFor(t, sexKey));
    }
    const si = siReport && t.otherUnits ? t.otherUnits[0] : undefined;
    let shown = v0;
    let canonical = v0;
    let pr = printRange(low, high);
    if (si) {
      const dec = si.unit.startsWith('µ') || si.unit === 'g/L' ? 0 : si.factor > 30 ? 2 : 1;
      shown = round(v0 / si.factor, dec);
      canonical = round(shown * si.factor, 2);
      const conv = (x?: number) => (x === undefined ? x : round(x / si.factor, dec + (dec === 0 ? 0 : 1)));
      pr = printRange(conv(low), conv(high));
    }
    const status = printsRange
      ? statusOf(shown, pr.low, pr.high)
      : (() => {
          const b = rangeFor(t, sexKey);
          return statusOf(canonical, b.low, b.high);
        })();
    const unit = si ? si.unit : t.unit;
    const v = fmtNum(shown);
    if (format === 'colon') lines.push(`${label}: ${v} ${unit}`);
    else if (format === 'inline-ref') lines.push(`${label} ${v} ${unit} (Ref: ${pr.text})`);
    else if (format === 'table') lines.push(`${label.padEnd(24)} ${v.padEnd(11)} ${unit.padEnd(12)} ${pr.text}`);
    else lines.push(`${label} - ${v} ${unit}`);
    labs.push({ key, value: canonical, status, format, range: printsRange ? 'printed' : 'built-in', ...(si ? { unit: si.unit } : {}) });
  }
  let bp: Report['bp'];
  if (r() < 0.5) {
    const sys = 95 + Math.floor(r() * 70), dia = 60 + Math.floor(r() * 40);
    lines.push(`Blood pressure: ${sys}/${dia} mmHg`);
    bp = { sys, dia };
  }
  lines.push('');
  // narrative with unlabelled personal details
  const narrative = pick(r, [
    `Impression: ${first} is a ${age}-year-old resident of ${place}; advised review with Dr. ${doc} in two weeks.`,
    `Impression: Reviewed on ${visit}. ${name} can be reached on ${phone} for follow-up.`,
    `Impression: Findings discussed with ${first} ${last}. Repeat tests after ${MONTHS[mo]} ${2026}.`
  ]);
  lines.push(narrative);
  if (narrative.includes('resident of')) pii.push({ type: 'address', value: place, context: 'narrative' }, { type: 'name', value: first, context: 'narrative' });
  if (narrative.includes('reached on')) pii.push({ type: 'name', value: name, context: 'narrative' }, { type: 'phone', value: phone, context: 'narrative' });
  if (narrative.includes('discussed with')) pii.push({ type: 'name', value: name, context: 'narrative' }, { type: 'date', value: `${MONTHS[mo]} 2026`, context: 'narrative' });

  if (opts.hard) {
    // relatives, a second clinician and the sample collector, named without labels
    const rare = r() < 0.4;
    const relName = `${pick(r, rare ? RARE_FIRST : FIRST)} ${pick(r, rare ? RARE_LAST : LAST)}`;
    const rel = pick(r, RELATIONS);
    const relLine = pick(r, [
      `Accompanied by ${sex === 'F' ? 'her' : 'his'} ${rel} ${relName}, who gave the history.`,
      `Informant: ${relName} (${rel}).`,
      `${pick(r, ['Mr.', 'Mrs.', 'Ms.'])} ${relName} called to ask about the results.`,
      `Result explained to ${sex === 'F' ? 'her' : 'his'} ${rel}, ${relName}.`
    ]);
    lines.push(relLine);
    pii.push({ type: 'relative', value: relName, context: relLine.startsWith('Informant') ? 'labelled' : 'narrative', rareName: rare });
    if (doc2 && r() < 0.5) {
      lines.push(`Case discussed with Dr. ${doc2}.`);
      pii.push({ type: 'clinician', value: doc2, context: 'narrative', rareName: RARE_FIRST.some((n) => doc2.startsWith(n)) || RARE_LAST.some((n) => doc2.endsWith(n)) });
    }
    if (r() < 0.5) {
      const rareT = r() < 0.4;
      const tech = `${pick(r, rareT ? RARE_FIRST : FIRST)} ${pick(r, rareT ? RARE_LAST : LAST)}`;
      lines.push(`Sample collected by ${tech} at ${pick(r, ['7:40 am', '8:15 am', '9:05 am'])}.`);
      pii.push({ type: 'relative', value: tech, context: 'narrative', rareName: rareT });
    }
  }
  lines.push(`Reported by: Dr. ${doc}`);
  pii.push({ type: 'clinician', value: doc, context: 'labelled' });
  return { id, text: lines.join('\n'), patientName: name, pii, labs, bp };
}

export const DEV_SEED = 20260925; // used while building the evaluation
export const TEST_SEED = 777001; // held-out data for the reported figures
export const HARD_TEST_SEED = 888001; // held-out hard set (Phase 9), generated once after the changes were made
export const makeDataset = (n: number, seed = TEST_SEED, opts: DatasetOptions = {}) => {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => makeReport(i + 1, r, opts));
};
