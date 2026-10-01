"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clinicalDate = exports.recordText = void 0;
/** Notes created automatically when a file is uploaded without notes — not real content. */
const PLACEHOLDER_NOTES = /^(Protected health record: |Personal medical document\.?$)/;
/**
 * Everything readable in a record, for AI features: the notes typed at upload plus the text
 * read from the file itself (PDF text layer, OCR of scans and photos, Word documents).
 */
const recordText = (r) => {
    const notes = r.report && !PLACEHOLDER_NOTES.test(r.report.trim()) ? r.report.trim() : '';
    const fromFile = (r.extractedText || '').trim();
    if (!fromFile)
        return notes;
    if (notes && fromFile.includes(notes))
        return fromFile;
    return [notes, `[Text read from ${r.fileName}]\n${fromFile}`].filter(Boolean).join('\n\n');
};
exports.recordText = recordText;
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const DATE_LABEL = /(?:collect(?:ed|ion)(?:\s*(?:date|on|at))?|sample\s*(?:date|drawn|taken)|specimen\s*date|report(?:ed)?(?:\s*(?:date|on))?|date\s*of\s*(?:report|test|collection|visit)|test\s*date|visit\s*date|date)\s*[:\-]?\s*/i;
const build = (y, m, d) => {
    if (y < 100)
        y += 2000;
    const dt = new Date(Date.UTC(y, m, d, 12));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m && dt.getUTCDate() === d ? dt : null;
};
const parseDate = (s) => {
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m)
        return build(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) {
        const a = +m[1];
        const b = +m[2];
        // Nepal and India write day first; switch only when that is impossible
        return a > 12 || b <= 12 ? build(+m[3], b - 1, a) : build(+m[3], a - 1, b);
    }
    m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3})[a-z]*\.?,?[\s-]+(\d{2,4})/);
    if (m && MONTHS[m[2].toLowerCase()] !== undefined)
        return build(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
    m = s.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
    if (m && MONTHS[m[1].toLowerCase()] !== undefined)
        return build(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
    return null;
};
/**
 * The date the test was actually done ("Collected: 11/05/2024", "Report Date 12 May 2024"),
 * so trends follow when a sample was taken rather than when the file was uploaded.
 * Dates in the future (for example Nepali B.S. years such as 2081) are ignored.
 */
const clinicalDate = (text) => {
    if (!text)
        return null;
    const re = new RegExp(DATE_LABEL.source, 'gi');
    let match;
    const now = Date.now() + 86_400_000;
    while ((match = re.exec(text.slice(0, 5000)))) {
        const d = parseDate(text.slice(match.index + match[0].length, match.index + match[0].length + 30));
        if (d && d.getTime() <= now && d.getUTCFullYear() >= 1990)
            return d;
    }
    return null;
};
exports.clinicalDate = clinicalDate;
