"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.numericRange = exports.evaluateMeasurement = exports.findTestInQuestion = exports.extractClinicalData = void 0;
const labReference_js_1 = require("./labReference.js");
const drugKnowledge_js_1 = require("./drugKnowledge.js");
const NUMBER = '(\\d{1,3}(?:,\\d{2,3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';
const toNumber = (raw) => Number(raw.replace(/,/g, ''));
const detectSex = (text) => {
    if (/\b(sex|gender)\s*[:\-]?\s*(f|female)\b|\b\d{1,3}\s*(?:y|yrs|years)?\s*\/\s*f\b|\bfemale\b/i.test(text))
        return 'female';
    if (/\b(sex|gender)\s*[:\-]?\s*(m|male)\b|\b\d{1,3}\s*(?:y|yrs|years)?\s*\/\s*m\b|\bmale\b/i.test(text))
        return 'male';
    return 'unknown';
};
const classify = (test, value, sex) => {
    const { low, high } = (0, labReference_js_1.rangeFor)(test, sex);
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
const display = (test, value) => {
    const v = value >= 1000 ? value.toLocaleString('en-US') : String(Math.round(value * 100) / 100);
    return `${v} ${test.unit}`;
};
/** Layer 2 — numeric comparator against the reference table. */
const extractValues = (text, sex) => {
    const out = [];
    // Blood pressure needs its own pattern (systolic/diastolic pair)
    const bp = text.match(/(?:\bBP\b|blood\s*pressure)[^\d\n]{0,15}(\d{2,3})\s*\/\s*(\d{2,3})|(\d{2,3})\s*\/\s*(\d{2,3})\s*mm\s*hg/i);
    if (bp) {
        const sys = Number(bp[1] || bp[3]);
        const dia = Number(bp[2] || bp[4]);
        const sysTest = labReference_js_1.LAB_TESTS.find((t) => t.key === 'systolic_bp');
        const diaTest = labReference_js_1.LAB_TESTS.find((t) => t.key === 'diastolic_bp');
        if (sys >= 50 && sys <= 260 && dia >= 30 && dia <= 160) {
            out.push({ key: sysTest.key, label: sysTest.label, value: sys, unit: 'mmHg', display: `${sys}/${dia} mmHg`, referenceRange: '90–120 / 60–80 mmHg', ...classify(sysTest, sys, sex) });
            out.push({ key: diaTest.key, label: diaTest.label, value: dia, unit: 'mmHg', display: `${sys}/${dia} mmHg`, referenceRange: '60–80 mmHg', ...classify(diaTest, dia, sex) });
        }
    }
    const taken = new Set();
    for (const test of labReference_js_1.LAB_TESTS) {
        if (!test.aliases || taken.has(test.key))
            continue;
        // alias, optional "(unit)" or words like "is/of/was", optional separator, then the number
        const re = new RegExp(`(?<![A-Za-z])(?:${test.aliases})(?![A-Za-z])(?:\\s*\\([^)\\n]*\\))?[^\\d\\n]{0,25}?${NUMBER}`, 'i');
        const m = text.match(re);
        if (!m)
            continue;
        let value = toNumber(m[1]);
        // "2.6 lakh" platelets
        const after = text.slice((m.index || 0) + m[0].length, (m.index || 0) + m[0].length + 12);
        if (test.key === 'platelets' && /^\s*lakh/i.test(after))
            value = value * 100000;
        if (test.normalise)
            value = test.normalise(value);
        if (!Number.isFinite(value))
            continue;
        taken.add(test.key);
        out.push({
            key: test.key,
            label: test.label,
            value,
            unit: test.unit,
            display: display(test, value),
            referenceRange: (0, labReference_js_1.formatRange)(test, sex),
            ...classify(test, value, sex)
        });
    }
    // random glucose duplicates the fasting value when only "fasting blood sugar" was written
    const fasting = out.find((v) => v.key === 'fasting_glucose');
    return out.filter((v) => !(v.key === 'random_glucose' && fasting && fasting.value === v.value));
};
/** Layer 1 — keyword scanner. */
const scanKeywords = (text) => {
    const flags = [];
    for (const rawLine of text.split(/\n|(?<=\.)\s+(?=[A-Z])/)) {
        const line = rawLine.trim();
        if (!line)
            continue;
        const m = line.match(/\b(CRITICAL|HIGH|LOW|ABNORMAL|BORDERLINE)\b|\((H|L)\)|\s(H|L)$/);
        if (!m)
            continue;
        const flag = (m[1] || ((m[2] || m[3]) === 'H' ? 'HIGH' : 'LOW'));
        flags.push({ line: line.slice(0, 200), flag });
    }
    return flags.slice(0, 30);
};
const findImpressions = (text) => {
    const out = [];
    const re = /\b(impression|diagnosis|assessment|conclusion|findings?|opinion)\s*[:\-]\s*([^\n]{3,240})/gi;
    let m;
    while ((m = re.exec(text)) && out.length < 6)
        out.push(m[2].trim());
    return out;
};
const extractClinicalData = (text, sexHint) => {
    const sex = sexHint && sexHint !== 'unknown' ? sexHint : detectSex(text);
    const values = extractValues(text, sex);
    return {
        values,
        abnormal: values.filter((v) => v.status !== 'normal'),
        keywordFlags: scanKeywords(text),
        medications: (0, drugKnowledge_js_1.findDrugsInText)(text).map((d) => d.name),
        impressions: findImpressions(text),
        sex
    };
};
exports.extractClinicalData = extractClinicalData;
/** Which measurement is a free-text question about? (e.g. "what was my fasting sugar?") */
const findTestInQuestion = (question) => {
    const q = question.toLowerCase();
    if (/\bblood\s*pressure\b|\bbp\b/.test(q))
        return 'systolic_bp';
    // longest alias match wins, so "fasting blood sugar" beats "blood sugar"
    let best = null;
    for (const test of labReference_js_1.LAB_TESTS) {
        if (!test.aliases)
            continue;
        const m = q.match(new RegExp(`(?<![A-Za-z])(?:${test.aliases})(?![A-Za-z])`, 'i'));
        if (m && (!best || m[0].length > best.len))
            best = { key: test.key, len: m[0].length };
        const label = test.label.toLowerCase().replace(/\s*\(.*\)/, '');
        if (q.includes(label) && (!best || label.length > best.len))
            best = { key: test.key, len: label.length };
    }
    return best?.key || null;
};
exports.findTestInQuestion = findTestInQuestion;
/** Evaluates one measurement against the reference table (used for home and clinic readings). */
const evaluateMeasurement = (key, raw, sex = 'unknown') => {
    const test = labReference_js_1.LAB_TESTS.find((t) => t.key === key);
    if (!test)
        return null;
    const value = test.normalise ? test.normalise(raw) : raw;
    return {
        key: test.key,
        label: test.label,
        value,
        unit: test.unit,
        display: display(test, value),
        referenceRange: (0, labReference_js_1.formatRange)(test, sex),
        ...classify(test, value, sex)
    };
};
exports.evaluateMeasurement = evaluateMeasurement;
/** Numeric normal range for charts (undefined where there is no universal range, e.g. weight). */
const numericRange = (key, sex = 'unknown') => {
    const test = labReference_js_1.LAB_TESTS.find((t) => t.key === key);
    return test ? (0, labReference_js_1.rangeFor)(test, sex) : {};
};
exports.numericRange = numericRange;
