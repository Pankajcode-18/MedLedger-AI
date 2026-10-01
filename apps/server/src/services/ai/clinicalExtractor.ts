import { LAB_TESTS, ReferenceTest, Sex, rangeFor, formatRange } from './labReference.js';
import { findDrugsInText } from './drugKnowledge.js';

export interface ExtractedValue {
  key: string;
  label: string;
  value: number;
  unit: string;
  display: string;
  referenceRange: string;
  status: 'normal' | 'low' | 'high';
  /** Layer-3 style severity (Project Guide §6.3). */
  severity?: 'mild' | 'moderate' | 'requires attention';
  meaning?: string;
  /** Read from a scan with low confidence (marked "?" by OCR): check it against the original report. */
  uncertain?: boolean;
  /** 'report' when the range printed next to the value was used instead of the built-in adult range. */
  rangeSource?: 'report';
}

export interface KeywordFlag {
  line: string;
  flag: 'CRITICAL' | 'HIGH' | 'LOW' | 'ABNORMAL' | 'BORDERLINE';
}

export interface ClinicalExtraction {
  values: ExtractedValue[];
  abnormal: ExtractedValue[];
  keywordFlags: KeywordFlag[];
  medications: string[];
  impressions: string[];
  sex: Sex;
  /** Age in years when the report states it (Phase 9). */
  ageYears?: number;
  /** A caution about the reference ranges used, e.g. adult ranges for a child. */
  rangeNote?: string;
}

const NUMBER = '(\\d{1,3}(?:,\\d{2,3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';

const toNumber = (raw: string): number => Number(raw.replace(/,/g, ''));

/** "Age: 12", "Age/Sex: 12/F", "12 yrs / M", "Age 8 months" → years (months count as 0). */
const detectAge = (text: string): number | undefined => {
  const m = text.match(/\bAge(?:\s*\/\s*(?:Sex|Gender))?\s*[:\-]?\s*(\d{1,3})\s*(y(?:ea)?rs?|y|months?|mo|m(?![\/a-z]))?/i) || text.match(/\b(\d{1,3})\s*(y(?:ea)?rs?|years?|y)\s*\/\s*[MF]\b/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (m[2] && /^mo|^months?$/i.test(m[2])) return 0;
  return n > 0 && n < 120 ? n : undefined;
};

const detectSex = (text: string): Sex => {
  if (/\b(sex|gender)\s*[:\-]?\s*(f|female)\b|\b\d{1,3}\s*(?:y|yrs|years)?\s*\/\s*f\b|\bfemale\b/i.test(text)) return 'female';
  if (/\b(sex|gender)\s*[:\-]?\s*(m|male)\b|\b\d{1,3}\s*(?:y|yrs|years)?\s*\/\s*m\b|\bmale\b/i.test(text)) return 'male';
  return 'unknown';
};

const classify = (test: ReferenceTest, value: number, sex: Sex): Pick<ExtractedValue, 'status' | 'severity' | 'meaning'> => {
  const { low, high } = rangeFor(test, sex);
  if (high !== undefined && value > high) {
    const critical = test.criticalHigh !== undefined && value >= test.criticalHigh;
    const pct = (value - high) / (high || 1);
    return {
      status: 'high',
      severity: critical ? 'requires attention' : pct > 0.2 ? 'moderate' : 'mild',
      meaning: test.highMeans
    };
  }
  if (low !== undefined && value < low) {
    const critical = test.criticalLow !== undefined && value <= test.criticalLow;
    const pct = (low - value) / (low || 1);
    return {
      status: 'low',
      severity: critical ? 'requires attention' : pct > 0.2 ? 'moderate' : 'mild',
      meaning: test.lowMeans
    };
  }
  return { status: 'normal' };
};

const display = (test: ReferenceTest, value: number): string => {
  const v = value >= 1000 ? value.toLocaleString('en-US') : String(Math.round(value * 100) / 100);
  return `${v} ${test.unit}`;
};


/**
 * A reference range printed after the value on the same line: "(Ref: 12.0 - 15.5)", "12 - 17.5",
 * "70 to 100", "< 200", "> 40". Converted with the value's unit factor, and only trusted when it is
 * plausible for this test (within a factor of 3 of the built-in range), so a date or an ID on the
 * line is never mistaken for a range.
 */
const printedRange = (rest: string, test: ReferenceTest, factor: number, sex: Sex): { low?: number; high?: number } | null => {
  const num = '(\\d+(?:[.,]\\d+)?)';
  const both = rest.match(new RegExp(`(?:ref(?:erence)?(?:\\s*(?:range|interval))?|normal|range|bio\\.?\\s*ref\\.?\\s*interval)?\\s*[:.]?\\s*\\(?\\s*${num}\\s*(?:-|–|to)\\s*${num}\\s*\\)?`, 'i'));
  const lessThan = rest.match(new RegExp(`(?:<|up\\s*to|less\\s*than)\\s*=?\\s*${num}`, 'i'));
  const moreThan = rest.match(new RegExp(`(?:>|more\\s*than|above)\\s*=?\\s*${num}`, 'i'));
  const n = (s: string) => Number(s.replace(',', '.')) * factor;
  let low: number | undefined;
  let high: number | undefined;
  if (both) {
    low = n(both[1]);
    high = n(both[2]);
    if (!(low < high)) return null;
  } else if (lessThan) {
    // "< 200" means values of 200 and over are high
    high = n(lessThan[1]) - (Number.isInteger(n(lessThan[1])) ? 1 : 0.01);
  } else if (moreThan) {
    low = n(moreThan[1]);
  } else return null;
  const builtIn = rangeFor(test, sex);
  const ok = (p: number | undefined, b: number | undefined) => p === undefined || b === undefined || b === 0 || (p / b <= 3 && p / b >= 1 / 3);
  const anchor = builtIn.low ?? builtIn.high;
  if (anchor === undefined || !ok(low ?? high, low !== undefined ? builtIn.low ?? anchor : builtIn.high ?? anchor)) return null;
  return { low: low === undefined ? undefined : Math.round(low * 100) / 100, high: high === undefined ? undefined : Math.round(high * 100) / 100 };
};

/** Layer 2 — numeric comparator against the reference table. */
const extractValues = (text: string, sex: Sex): ExtractedValue[] => {
  const out: ExtractedValue[] = [];

  // Blood pressure needs its own pattern (systolic/diastolic pair)
  const bp = text.match(/(?:\bBP\b|blood\s*pressure)[^\d\n]{0,15}(\d{2,3})\s*\/\s*(\d{2,3})|(\d{2,3})\s*\/\s*(\d{2,3})\s*mm\s*hg/i);
  if (bp) {
    const sys = Number(bp[1] || bp[3]);
    const dia = Number(bp[2] || bp[4]);
    const sysTest = LAB_TESTS.find((t) => t.key === 'systolic_bp') as ReferenceTest;
    const diaTest = LAB_TESTS.find((t) => t.key === 'diastolic_bp') as ReferenceTest;
    if (sys >= 50 && sys <= 260 && dia >= 30 && dia <= 160) {
      out.push({ key: sysTest.key, label: sysTest.label, value: sys, unit: 'mmHg', display: `${sys}/${dia} mmHg`, referenceRange: '90–120 / 60–80 mmHg', ...classify(sysTest, sys, sex) });
      out.push({ key: diaTest.key, label: diaTest.label, value: dia, unit: 'mmHg', display: `${sys}/${dia} mmHg`, referenceRange: '60–80 mmHg', ...classify(diaTest, dia, sex) });
    }
  }

  const taken = new Set<string>();
  for (const test of LAB_TESTS) {
    if (!test.aliases || taken.has(test.key)) continue;
    // alias, optional "(unit)" or words like "is/of/was", optional separator, then the number
    const re = new RegExp(`(?<![A-Za-z])(?:${test.aliases})(?![A-Za-z])(?:\\s*\\([^)\\n]*\\))?[^\\d\\n]{0,25}?${NUMBER}(\\?)?`, 'gi');
    // the first mention whose value is physically possible (a misread "1080 %" oxygen is skipped)
    for (const m of text.matchAll(re)) {
      let value = toNumber(m[1]);
      const end = (m.index || 0) + m[0].length;
      const lineEnd = text.indexOf('\n', end);
      const rest = text.slice(end, lineEnd < 0 ? undefined : lineEnd);
      // "2.6 lakh" platelets
      if (test.key === 'platelets' && /^\s*lakh/i.test(rest)) value = value * 100000;
      // another unit ("5.6 mmol/L" glucose): convert to the unit of the reference table
      const other = test.otherUnits?.find((u) => u.pattern.test(rest.trimStart()));
      const factor = other ? other.factor : 1;
      const rawValue = value;
      value = value * factor;
      if (test.normalise && !other) value = test.normalise(value);
      if (!Number.isFinite(value)) continue;
      if (test.limits && (value < test.limits[0] || value > test.limits[1])) continue;
      value = Math.round(value * 100) / 100;
      // the report's own reference range on the same line wins over the built-in one
      const printed = printedRange(rest, test, factor, sex);
      const rangeTest: ReferenceTest = printed ? { ...test, low: printed.low, high: printed.high, bySex: undefined } : test;
      taken.add(test.key);
      out.push({
        key: test.key,
        label: test.label,
        value,
        unit: test.unit,
        display: other ? `${display(test, value)} (${rawValue} ${other.unit})` : display(test, value),
        referenceRange: printed ? `${formatRange(rangeTest, 'unknown')} (from the report)` : formatRange(test, sex),
        ...classify(rangeTest, value, sex),
        ...(m[2] ? { uncertain: true } : {}),
        ...(printed ? { rangeSource: 'report' as const } : {})
      });
      break;
    }
  }

  // random glucose duplicates the fasting value when only "fasting blood sugar" was written
  const fasting = out.find((v) => v.key === 'fasting_glucose');
  return out.filter((v) => !(v.key === 'random_glucose' && fasting && fasting.value === v.value));
};

/** Layer 1 — keyword scanner. */
const scanKeywords = (text: string): KeywordFlag[] => {
  const flags: KeywordFlag[] = [];
  for (const rawLine of text.split(/\n|(?<=\.)\s+(?=[A-Z])/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(/\b(CRITICAL|HIGH|LOW|ABNORMAL|BORDERLINE)\b|\((H|L)\)|\s(H|L)$/);
    if (!m) continue;
    const flag = (m[1] || ((m[2] || m[3]) === 'H' ? 'HIGH' : 'LOW')) as KeywordFlag['flag'];
    flags.push({ line: line.slice(0, 200), flag });
  }
  return flags.slice(0, 30);
};

const findImpressions = (text: string): string[] => {
  const out: string[] = [];
  const re = /\b(impression|diagnosis|assessment|conclusion|findings?|opinion)\s*[:\-]\s*([^\n]{3,240})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < 6) out.push(m[2].trim());
  return out;
};

export const extractClinicalData = (text: string, sexHint?: Sex): ClinicalExtraction => {
  const sex = sexHint && sexHint !== 'unknown' ? sexHint : detectSex(text);
  const values = extractValues(text, sex);
  const ageYears = detectAge(text);
  return {
    ...(ageYears !== undefined ? { ageYears } : {}),
    // the built-in ranges are for adults; a report that prints its own ranges is still read against those
    ...(ageYears !== undefined && ageYears < 18 && values.some((v) => !v.rangeSource)
      ? { rangeNote: 'The patient appears to be under 18. Adult reference ranges were used where the report did not print its own, so check the flags against paediatric ranges.' }
      : {}),
    values,
    abnormal: values.filter((v) => v.status !== 'normal'),
    keywordFlags: scanKeywords(text),
    medications: findDrugsInText(text).map((d) => d.name),
    impressions: findImpressions(text),
    sex
  };
};

/** Which measurement is a free-text question about? (e.g. "what was my fasting sugar?") */
export const findTestInQuestion = (question: string): string | null => {
  const q = question.toLowerCase();
  if (/\bblood\s*pressure\b|\bbp\b/.test(q)) return 'systolic_bp';
  // longest alias match wins, so "fasting blood sugar" beats "blood sugar"
  let best: { key: string; len: number } | null = null;
  for (const test of LAB_TESTS) {
    if (!test.aliases) continue;
    const m = q.match(new RegExp(`(?<![A-Za-z])(?:${test.aliases})(?![A-Za-z])`, 'i'));
    if (m && (!best || m[0].length > best.len)) best = { key: test.key, len: m[0].length };
    const label = test.label.toLowerCase().replace(/\s*\(.*\)/, '');
    if (q.includes(label) && (!best || label.length > best.len)) best = { key: test.key, len: label.length };
  }
  return best?.key || null;
};

/** Evaluates one measurement against the reference table (used for home and clinic readings). */
export const evaluateMeasurement = (key: string, raw: number, sex: Sex = 'unknown'): ExtractedValue | null => {
  const test = LAB_TESTS.find((t) => t.key === key);
  if (!test) return null;
  const value = test.normalise ? test.normalise(raw) : raw;
  return {
    key: test.key,
    label: test.label,
    value,
    unit: test.unit,
    display: display(test, value),
    referenceRange: formatRange(test, sex),
    ...classify(test, value, sex)
  };
};

/** Numeric normal range for charts (undefined where there is no universal range, e.g. weight). */
export const numericRange = (key: string, sex: Sex = 'unknown'): { low?: number; high?: number } => {
  const test = LAB_TESTS.find((t) => t.key === key);
  return test ? rangeFor(test, sex) : {};
};
