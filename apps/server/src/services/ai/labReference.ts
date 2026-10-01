/**
 * Adult reference ranges used by the numeric comparator (Project Guide §6.3, Layer 2).
 * Ranges are typical adult values; individual laboratories may differ slightly.
 * Critical limits mark values that usually need prompt clinical attention.
 */

export type Sex = 'male' | 'female' | 'unknown';

export interface ReferenceTest {
  key: string;
  label: string;
  unit: string;
  /** Regex source for names/synonyms that may appear in a report. */
  aliases: string;
  low?: number;
  high?: number;
  /** Sex-specific ranges override low/high when the sex is known. */
  bySex?: { male: [number | undefined, number | undefined]; female: [number | undefined, number | undefined] };
  /**
   * Other units a report may use, and the factor to this test's unit ("5.6 mmol/L" glucose × 18.016
   * = 101 mg/dL). The pattern is matched against the text right after the number.
   */
  otherUnits?: Array<{ unit: string; pattern: RegExp; factor: number }>;
  criticalLow?: number;
  criticalHigh?: number;
  /** Physically possible values [min, max]; a reading outside them is a misread and is ignored. */
  limits?: [number, number];
  /** Converts a raw number (e.g. platelets written as 2.6 lakh or 260 x10^3) into the unit above. */
  normalise?: (value: number) => number;
  /** What a high / low value generally relates to — plain language, never a diagnosis. */
  highMeans?: string;
  lowMeans?: string;
}

const thousandsPerMicroLitre = (v: number): number => (v < 1000 ? v * 1000 : v);

export const LAB_TESTS: ReferenceTest[] = [
  // ---- Vital signs ----
  {
    key: 'systolic_bp', label: 'Blood Pressure (systolic)', unit: 'mmHg', aliases: '', low: 90, high: 120,
    criticalLow: 80, criticalHigh: 180,
    highMeans: 'Blood pressure above the normal range; repeated readings of 130/80 or more are considered high blood pressure.',
    lowMeans: 'Blood pressure below the usual range, which can cause dizziness or tiredness.'
  },
  {
    key: 'diastolic_bp', label: 'Blood Pressure (diastolic)', unit: 'mmHg', aliases: '', low: 60, high: 80,
    criticalLow: 50, criticalHigh: 120,
    highMeans: 'The lower blood-pressure number is raised.', lowMeans: 'The lower blood-pressure number is low.'
  },
  {
    key: 'heart_rate', label: 'Heart Rate', unit: 'bpm', aliases: 'heart\\s*rate|pulse(?:\\s*rate)?|(?<!/)HR', low: 60, high: 100, limits: [20, 300],
    criticalLow: 40, criticalHigh: 130,
    highMeans: 'A fast resting heart rate (tachycardia) — can be caused by fever, dehydration, anxiety or heart conditions.',
    lowMeans: 'A slow resting heart rate — common in fit people, but can also relate to medicines or heart rhythm problems.'
  },
  {
    key: 'spo2', label: 'Oxygen Saturation (SpO2)', unit: '%', aliases: 'Sp[O0Q][2z]|SpO₂|oxygen\\s*saturation|O2\\s*sat(?:uration)?|sats', low: 95, high: 100, limits: [40, 100],
    criticalLow: 90,
    lowMeans: 'Less oxygen in the blood than normal. Values below 90% usually need urgent medical attention.'
  },
  {
    key: 'temperature', label: 'Body Temperature', unit: '°C', aliases: 'temp(?:erature)?', low: 36.1, high: 37.5, limits: [25, 45],
    criticalLow: 35, criticalHigh: 40,
    normalise: (v) => (v > 50 ? Math.round(((v - 32) * 5) / 9 * 10) / 10 : v),
    highMeans: 'A raised temperature (fever), often a sign the body is fighting an infection.',
    lowMeans: 'A lower than normal body temperature.'
  },
  // no universal normal range; tracked for trends only
  { key: 'weight', label: 'Body Weight', unit: 'kg', aliases: '(?:body\\s*)?(?:weight|\\bwt\\b)(?!\\s*(?:loss|gain|bearing|-bearing|reduction))' },
  {
    key: 'resp_rate', label: 'Respiratory Rate', unit: 'breaths/min', aliases: 'resp(?:iratory)?\\s*rate|RR', low: 12, high: 20, limits: [3, 80],
    criticalLow: 8, criticalHigh: 30,
    highMeans: 'Breathing faster than normal.', lowMeans: 'Breathing slower than normal.'
  },

  // ---- Blood count ----
  {
    key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', otherUnits: [{ unit: 'g/L', pattern: /^g\s*\/\s*l\b/i, factor: 0.1 }], aliases: '(?<!glycated\\s)(?<!glycosylated\\s)ha?emoglobin(?!\\s*A1c)|\\bHb\\b(?!\\s*A1c)|\\bHgb\\b',
    low: 12.0, high: 17.5, bySex: { male: [13.5, 17.5], female: [12.0, 15.5] }, criticalLow: 7, criticalHigh: 20,
    lowMeans: 'Low hemoglobin (anaemia) means the blood carries less oxygen, which can cause tiredness and breathlessness.',
    highMeans: 'High hemoglobin can occur with dehydration, smoking or some lung and bone-marrow conditions.'
  },
  {
    key: 'wbc', label: 'White Blood Cells (WBC)', unit: '/µL', aliases: 'WBC|white\\s*blood\\s*cells?|TLC|total\\s*leu[ck]ocyte\\s*count|leu[ck]ocytes',
    low: 4500, high: 11000, criticalLow: 2000, criticalHigh: 30000, normalise: thousandsPerMicroLitre,
    highMeans: 'A raised white-cell count, often seen with infection or inflammation.',
    lowMeans: 'A low white-cell count, which can reduce the body\'s ability to fight infection.'
  },
  {
    key: 'platelets', label: 'Platelet Count', unit: '/µL', aliases: 'platelets?(?:\\s*count)?|PLT',
    low: 150000, high: 400000, criticalLow: 50000, criticalHigh: 1000000,
    normalise: (v) => (v < 10 ? v * 100000 /* lakh */ : v < 1000 ? v * 1000 : v),
    lowMeans: 'Low platelets can make bruising or bleeding easier.',
    highMeans: 'High platelets can occur with inflammation, iron deficiency or bone-marrow conditions.'
  },
  {
    key: 'rbc', label: 'Red Blood Cells (RBC)', unit: 'million/µL', aliases: 'RBC(?:\\s*count)?|red\\s*blood\\s*cells?',
    low: 4.2, high: 5.9, normalise: (v) => (v > 100 ? v / 1_000_000 : v),
    lowMeans: 'Fewer red blood cells than normal.', highMeans: 'More red blood cells than normal.'
  },
  { key: 'hematocrit', label: 'Hematocrit (PCV)', unit: '%', aliases: 'ha?ematocrit|HCT|PCV', low: 36, high: 52 },
  { key: 'esr', label: 'ESR', unit: 'mm/hr', aliases: 'ESR|erythrocyte\\s*sedimentation\\s*rate', low: 0, high: 20, highMeans: 'A raised ESR is a general marker of inflammation.' },

  // ---- Sugar ----
  {
    key: 'fasting_glucose', label: 'Fasting Blood Sugar', unit: 'mg/dL', otherUnits: [{ unit: 'mmol/L', pattern: /^mmol\s*\/\s*l\b/i, factor: 18.016 }], aliases: 'fasting\\s*(?:blood\\s*)?(?:sugar|glucose)|FBS|FBG|FPG',
    low: 70, high: 100, criticalLow: 54, criticalHigh: 400,
    highMeans: 'Fasting sugar of 100–125 mg/dL is in the prediabetes range; 126 mg/dL or more on repeat testing is in the diabetes range.',
    lowMeans: 'Low blood sugar (hypoglycaemia) can cause shakiness, sweating or confusion.'
  },
  {
    key: 'random_glucose', label: 'Random Blood Sugar', unit: 'mg/dL', otherUnits: [{ unit: 'mmol/L', pattern: /^mmol\s*\/\s*l\b/i, factor: 18.016 }], aliases: 'random\\s*(?:blood\\s*)?(?:sugar|glucose)|RBS|(?<!fasting\\s)(?<!fasting\\s(?:blood\\s)?)\\b(?:blood\\s*)?(?:sugar|glucose)',
    low: 70, high: 140, criticalLow: 54, criticalHigh: 400,
    highMeans: 'Blood sugar above the usual range.', lowMeans: 'Low blood sugar.'
  },
  {
    key: 'hba1c', label: 'HbA1c', unit: '%', aliases: 'HbA1c|A1c|glycated\\s*ha?emoglobin|glycosylated\\s*ha?emoglobin',
    high: 5.6, criticalHigh: 14,
    highMeans: 'HbA1c of 5.7–6.4% is in the prediabetes range; 6.5% or more is in the diabetes range.'
  },

  // ---- Lipids ----
  { key: 'total_cholesterol', label: 'Total Cholesterol', unit: 'mg/dL', otherUnits: [{ unit: 'mmol/L', pattern: /^mmol\s*\/\s*l\b/i, factor: 38.67 }], aliases: 'total\\s*cholesterol|(?<!HDL\\s|LDL\\s)\\bcholesterol', high: 199, highMeans: 'Cholesterol above the desirable level (under 200 mg/dL) raises long-term heart risk.' },
  { key: 'ldl', label: 'LDL Cholesterol', unit: 'mg/dL', otherUnits: [{ unit: 'mmol/L', pattern: /^mmol\s*\/\s*l\b/i, factor: 38.67 }], aliases: 'LDL(?:[\\s-]*C(?:holesterol)?)?', high: 129, highMeans: '"Bad" cholesterol above the recommended level.' },
  { key: 'hdl', label: 'HDL Cholesterol', unit: 'mg/dL', otherUnits: [{ unit: 'mmol/L', pattern: /^mmol\s*\/\s*l\b/i, factor: 38.67 }], aliases: 'HDL(?:[\\s-]*C(?:holesterol)?)?', low: 40, bySex: { male: [40, undefined], female: [50, undefined] }, lowMeans: '"Good" (protective) cholesterol is lower than recommended.' },
  { key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', otherUnits: [{ unit: 'mmol/L', pattern: /^mmol\s*\/\s*l\b/i, factor: 88.57 }], aliases: 'triglycerides?|\\bTG\\b', high: 149, criticalHigh: 1000, highMeans: 'Blood fats above the normal level.' },

  // ---- Kidney, liver, electrolytes ----
  {
    key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', otherUnits: [{ unit: 'µmol/L', pattern: /^(?:µ|u|micro)mol\s*\/\s*l\b/i, factor: 1 / 88.42 }], aliases: '(?:serum\\s*)?creatinine',
    low: 0.6, high: 1.3, bySex: { male: [0.7, 1.3], female: [0.6, 1.1] }, criticalHigh: 4,
    highMeans: 'Raised creatinine can mean the kidneys are filtering less well.'
  },
  { key: 'urea', label: 'Blood Urea Nitrogen', unit: 'mg/dL', otherUnits: [{ unit: 'mmol/L', pattern: /^mmol\s*\/\s*l\b/i, factor: 2.801 }], aliases: 'BUN|blood\\s*urea\\s*nitrogen', low: 7, high: 20 },
  { key: 'uric_acid', label: 'Uric Acid', unit: 'mg/dL', otherUnits: [{ unit: 'µmol/L', pattern: /^(?:µ|u|micro)mol\s*\/\s*l\b/i, factor: 1 / 59.48 }], aliases: 'uric\\s*acid', low: 2.4, high: 7.0, bySex: { male: [3.4, 7.0], female: [2.4, 6.0] }, highMeans: 'High uric acid is linked with gout and kidney stones.' },
  { key: 'sodium', label: 'Sodium', unit: 'mmol/L', aliases: 'sodium|\\bNa\\+?(?=\\s*[:=]?\\s*\\d)', low: 135, high: 145, criticalLow: 125, criticalHigh: 155 },
  { key: 'potassium', label: 'Potassium', unit: 'mmol/L', aliases: 'potassium|\\bK\\+?(?=\\s*[:=]?\\s*\\d)', low: 3.5, high: 5.0, criticalLow: 3.0, criticalHigh: 6.0, highMeans: 'High potassium can affect heart rhythm.', lowMeans: 'Low potassium can cause weakness and heart-rhythm changes.' },
  { key: 'calcium', label: 'Calcium', unit: 'mg/dL', otherUnits: [{ unit: 'mmol/L', pattern: /^mmol\s*\/\s*l\b/i, factor: 4.008 }], aliases: '(?:serum\\s*)?calcium', low: 8.5, high: 10.5 },
  { key: 'alt', label: 'ALT (SGPT)', unit: 'U/L', aliases: 'ALT|SGPT|alanine\\s*aminotransferase', low: 7, high: 56, highMeans: 'Raised ALT can indicate liver irritation.' },
  { key: 'ast', label: 'AST (SGOT)', unit: 'U/L', aliases: 'AST|SGOT|aspartate\\s*aminotransferase', low: 10, high: 40, highMeans: 'Raised AST can indicate liver or muscle irritation.' },
  { key: 'bilirubin', label: 'Total Bilirubin', unit: 'mg/dL', otherUnits: [{ unit: 'µmol/L', pattern: /^(?:µ|u|micro)mol\s*\/\s*l\b/i, factor: 1 / 17.1 }], aliases: '(?:total\\s*)?bilirubin', low: 0.1, high: 1.2, highMeans: 'Raised bilirubin can cause yellowing of the skin or eyes (jaundice).' },

  // ---- Others ----
  { key: 'tsh', label: 'Thyroid TSH', unit: 'mIU/L', aliases: 'TSH|thyroid\\s*stimulating\\s*hormone', low: 0.4, high: 4.0, highMeans: 'A high TSH often means the thyroid is underactive.', lowMeans: 'A low TSH often means the thyroid is overactive.' },
  { key: 'vitamin_d', label: 'Vitamin D (25-OH)', unit: 'ng/mL', aliases: 'vitamin\\s*D(?:3)?|25[\\s-]*(?:OH|hydroxy)', low: 20, high: 100, lowMeans: 'Low vitamin D, which is common and affects bone health.' },
  { key: 'vitamin_b12', label: 'Vitamin B12', unit: 'pg/mL', aliases: 'vitamin\\s*B\\s*12|cobalamin', low: 200, high: 900, lowMeans: 'Low B12 can cause tiredness, anaemia and tingling.' }
];

export const rangeFor = (test: ReferenceTest, sex: Sex): { low?: number; high?: number } => {
  if (test.bySex && sex !== 'unknown') {
    const [low, high] = test.bySex[sex];
    return { low, high };
  }
  return { low: test.low, high: test.high };
};

export const formatRange = (test: ReferenceTest, sex: Sex): string => {
  const { low, high } = rangeFor(test, sex);
  const fmt = (n: number) => (n >= 1000 ? n.toLocaleString('en-US') : String(n));
  if (low !== undefined && high !== undefined) return `${fmt(low)}–${fmt(high)} ${test.unit}`;
  if (high !== undefined) return `< ${fmt(Math.round((high + (Number.isInteger(high) ? 1 : 0.1)) * 10) / 10)} ${test.unit}`;
  if (low !== undefined) return `> ${fmt(low)} ${test.unit}`;
  return test.unit;
};
