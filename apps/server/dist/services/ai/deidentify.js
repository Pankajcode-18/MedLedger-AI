"use strict";
/**
 * De-identification (Project Guide §7.2, Option 1).
 *
 * Removes personal identifiers from medical text BEFORE any AI processing, and above all before
 * anything is sent to an external AI API. Medical values, findings and medicine names are kept.
 *
 * Coverage follows the HIPAA Safe-Harbor list of 18 identifiers, adapted to Nepal and India:
 *   names (known users + labelled + relation/honorific forms), addresses and postal codes,
 *   all date elements except the year alone, phone numbers, emails, URLs, IP addresses,
 *   national IDs (Nepal citizenship / NID, Aadhaar, PAN, ABHA, SSN, passport, voter ID, licence),
 *   medical record / sample / insurance / claim numbers, bank accounts, IFSC, payment cards,
 *   vehicle numbers, device serials, Ethereum wallets, facility names and clinician names.
 *
 * Two public checks are built on top:
 *   - deidentify()      → the cleaned text plus per-category counts (never the removed values)
 *   - scanForPII()      → an independent, high-precision detector used as a fail-closed gate:
 *                          if it still finds anything, the text is NOT sent to the external model.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.containsObviousPII = exports.scanForPII = exports.deidentifyValue = exports.deidentify = void 0;
// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------
/**
 * "Label: value" style identifiers — keep the label, drop the value.
 * `sepOptional` is only used for numeric values (age, DOB, IDs, phone) so "Age 21" is caught
 * without turning ordinary words after labels such as "Registration of…" into redactions.
 */
const labelled = (labels, valuePattern, tag, category, sepOptional = false) => ({
    category,
    pattern: new RegExp(`(?<![A-Za-z])(${labels})(?![A-Za-z])(\\s*(?:[:#=\\-]|no\\.?|number)${sepOptional ? '?' : ''}\\s*(?:[:#=\\-]\\s*)?)${valuePattern}`, 'gi'),
    replace: (_m, label, sep) => `${label}${sep}[${tag}]`
});
const NAME = "[A-Z][A-Za-z'.-]*(?:[ \\t]+[A-Z][A-Za-z'.-]*){0,3}";
const NAME_CI = "[A-Za-z][A-Za-z'.-]+(?:[ \\t]+[A-Za-z][A-Za-z'.-]*){0,3}";
const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const PLACEHOLDER = /^\[[A-Z_]+\]$/;
/** Luhn checksum — distinguishes real card numbers from other long digit strings. */
const luhn = (raw) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19)
        return false;
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
        let d = Number(digits[digits.length - 1 - i]);
        if (i % 2 === 1) {
            d *= 2;
            if (d > 9)
                d -= 9;
        }
        sum += d;
    }
    return sum % 10 === 0;
};
// ---------------------------------------------------------------------------
// Rules — order matters: specific before generic, long numbers before short ones.
// ---------------------------------------------------------------------------
const RULES = [
    // --- Links and network identifiers ---
    { category: 'url', pattern: /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi, replace: '[URL]' },
    {
        category: 'ip_address',
        pattern: /(?<!\d|\d\.)(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?!\d|\.\d)/g,
        replace: '[IP]'
    },
    // Ethereum wallet addresses tie a person to on-chain activity
    { category: 'wallet', pattern: /\b0x[a-fA-F0-9]{40}\b/g, replace: '[WALLET]' },
    // --- Labelled identifiers ---
    labelled('Aadhaar|Aadhar|UID|UIDAI', '[\\dXx][\\dXx\\s-]{10,16}[\\dXx]', 'AADHAAR', 'national_id', true),
    labelled('ABHA|Health ID|ABHA Number', '\\d{2}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}', 'ABHA', 'national_id', true),
    labelled('NID|National ID|National Identity(?: Card)?', '\\d[\\d\\s-]{7,16}\\d', 'NID', 'national_id', true),
    labelled('PAN', '[A-Z]{5}\\d{4}[A-Z]', 'PAN', 'national_id'),
    labelled('SSN|Social Security', '\\d{3}-?\\d{2}-?\\d{4}', 'SSN', 'national_id'),
    labelled('Citizenship(?: Certificate)?(?: No)?|Nagarikta|Passport|Voter ID|Voter|EPIC|Driving Licen[cs]e|DL', '[A-Z0-9][A-Z0-9 /-]{3,20}[A-Z0-9]', 'ID', 'national_id'),
    labelled('MRN|UHID|IPD|OPD|IP No|OP No|Hospital No|Hospital ID|Registration|Reg|Patient ID|Patient No|Lab No|Lab ID|Sample ID|Sample No|Specimen ID|Barcode|Accession|Bed No|Case No|Visit ID|Encounter', '[A-Z0-9][A-Z0-9-/]{1,}', 'ID', 'record_id'),
    labelled('Policy|Policy No|Insurance|Insurance ID|Member ID|Claim|Claim No|TPA ID|Beneficiary ID|SSF ID', '[A-Z0-9][A-Z0-9-/]{3,}', 'POLICY', 'insurance_id'),
    // Medical/nursing council registration numbers: "NMC 12345", "NMC No. 12345"
    labelled('NMC|MCI|NHPC|NNC|NPC', '\\d{3,7}', 'LICENSE', 'license', true),
    labelled('License|Licence|Reg\\. No|NMC|MCI|DOC', '[A-Z0-9][A-Z0-9-/]{3,}', 'LICENSE', 'license'),
    labelled('A/c|Acct|Account|Bank Account|Account Number', '\\d[\\d\\s-]{6,20}\\d', 'ACCOUNT', 'bank_account', true),
    labelled('IFSC|SWIFT|BIC', '[A-Z]{4}[A-Z0-9]{4,7}', 'BANK_CODE', 'bank_account'),
    labelled('Vehicle|Vehicle No|Registration Plate|Number Plate', '[A-Z0-9][A-Za-z0-9 -]{3,14}[A-Za-z0-9]', 'VEHICLE', 'vehicle'),
    labelled('Serial|Serial No|Device ID|Device Serial|IMEI|MAC', '[A-Z0-9][A-Z0-9:-]{5,}', 'DEVICE_ID', 'device_id'),
    labelled('DOB|D\\.O\\.B|Date of Birth|Birth Date', '[0-9A-Za-z][0-9A-Za-z ,./-]{5,20}\\d', 'DOB', 'dob', true),
    labelled('Age', '\\d{1,3}\\s*(?:y(?:ears?|rs?)?|yo)?(?:\\s*/\\s*[MFmf])?', 'AGE', 'age', true),
    labelled('PIN|PIN Code|Pincode|Postal Code|Post Code|ZIP|ZIP Code', '\\d{5,6}', 'POSTCODE', 'address', true),
    labelled('Address|Addr|Residence|Resident of|Permanent Address|Temporary Address|Present Address|Lives at|Residing at', '[^\\n]{3,80}', 'ADDRESS', 'address'),
    // "resident of Baneshwor", "lives in Pokhara" — place names after these phrases (value must be capitalised)
    {
        category: 'address',
        pattern: /\b((?:[Rr]esident|[Rr]esiding|[Ll]iv(?:es|ing)|[Ss]tays?|[Ss]taying)\s+(?:of|at|in)|[Hh]ails from|[Nn]ative of)(\s+)([A-Z][A-Za-z'-]+(?:[ \t]+[A-Z][A-Za-z'-]+){0,3}(?:,[ \t]*[A-Z][A-Za-z'-]+(?:[ \t]+[A-Z][A-Za-z'-]+){0,2})?)/g,
        replace: (_m, label, sep) => `${label}${sep}[ADDRESS]`
    },
    labelled('House|Flat|Plot|Apartment|Apt', '[A-Za-z0-9][A-Za-z0-9/-]{0,8}', 'ADDRESS', 'address'),
    labelled('Phone|Ph|Mobile|Mob|Contact|Tel|Telephone|Cell|WhatsApp|Fax', '\\+?[\\d][\\d\\s()-]{6,16}\\d', 'PHONE', 'phone', true),
    // --- Names ---
    // Names after a label: "Patient: John Doe", "Name - jane doe" (a colon or dash is required so
    // ordinary sentences like "Patient presents with…" are left alone)
    {
        category: 'name',
        pattern: new RegExp(`\\b(Patient(?:'s)?\\s*Name|Name of (?:the )?Patient|Patient|(?<!(?:Test|Drug|Medicine|Brand|Generic|Investigation|Parameter|Product|File|User|Sample)\\s)Name|Pt\\.?|Guardian|Father(?:'s Name)?|Mother(?:'s Name)?|Husband(?:'s Name)?|Wife(?:'s Name)?|Spouse|Next of Kin|Attendant|Informant|Emergency Contact|Caregiver|Insured|Policy Holder|Beneficiary)(\\s*[:\\-]\\s*)(${NAME_CI})`, 'gi'),
        replace: (_m, label, sep) => `${label}${sep}[NAME]`
    },
    // Relation forms common in Nepal / India: "S/o Hari Bahadur", "W/o Ram", "C/o Sita Devi", "son of …"
    {
        category: 'name',
        pattern: new RegExp(`\\b(S/o|D/o|W/o|C/o|H/o|son of|daughter of|wife of|husband of)(\\.?\\s*)(${NAME_CI})`, 'gi'),
        replace: (_m, label, sep) => `${label}${sep}[NAME]`
    },
    // Honorifics followed by a capitalised name: "Mr. Ram Bahadur", "Dear Sita"
    {
        category: 'name',
        pattern: new RegExp(`\\b(Mr|Mrs|Ms|Miss|Mx|Master|Shri|Shree|Smt|Sushri|Kumari|Dear)(\\.?\\s+)(${NAME})`, 'g'),
        replace: (_m, label, sep) => `${label}${sep}[NAME]`
    },
    {
        category: 'clinician_name',
        pattern: new RegExp(`\\b(Referred by|Ref\\. by|Ref by|Consultant|Physician|Attending|Signed by|Reported by|Verified by|Checked by|Pathologist|Radiologist|Technician|Treating Doctor|Doctor|Dr\\.?)(\\s*[:\\-]?\\s*)(?:Dr\\.?\\s*)?(${NAME})`, 'g'),
        replace: (_m, label, sep) => `${label}${sep}[CLINICIAN]`
    },
    // Facility after a label ("Hospital: Bir Hospital") or a capitalised facility name ("Grande City Hospital")
    {
        category: 'facility',
        pattern: new RegExp(`\\b(Hospital|Clinic|Facility|Laboratory|Lab Name|Institution|Centre|Center|Collected at|Sample collected at)(\\s*[:\\-]\\s*)(${NAME_CI})`, 'gi'),
        replace: (_m, label, sep) => `${label}${sep}[FACILITY]`
    },
    {
        category: 'facility',
        pattern: /\b(?:[A-Z][A-Za-z&'.-]+\s+){1,4}(?:Hospital|Clinic|Polyclinic|Diagnostics|Diagnostic Cent(?:re|er)|Laborator(?:y|ies)|Medical College|Teaching Hospital|Nursing Home|Health ?care|Health Post|Medical Cent(?:re|er)|Poly Clinic)\b/g,
        replace: '[FACILITY]',
        // "Patient Hospital", "Normal Pathology" etc. are not facility names
        accept: (m) => !/^(?:The|A|An|At|In|To|From|Normal|Abnormal|Clinical|General|Patient|Report|Routine)\s+(?:Hospital|Clinic|Pathology|Laboratory|Labs|Imaging)$/i.test(m.trim())
    },
    // --- Unlabelled numbers (long before short) ---
    // Payment cards: 13–19 digits that pass the Luhn check
    { category: 'payment_card', pattern: /(?<!\d|\d\.)(?:\d{13,19}|\d{4}([ -])\d{4}\1\d{4}\1\d{1,4}|\d{4}([ -])\d{6}\2\d{5})(?!\d|\.\d)/g, replace: '[CARD]', accept: luhn },
    // ABHA: 14 digits written 2-4-4-4
    { category: 'national_id', pattern: /(?<!\d|\d[.-])\d{2}-\d{4}-\d{4}-\d{4}(?!\d|[.-]\d)/g, replace: '[ABHA]' },
    // Aadhaar: 12 digits written 4-4-4
    { category: 'national_id', pattern: /(?<!\d|\d\.)\d{4}[\s-]\d{4}[\s-]\d{4}(?!\d|\.\d)/g, replace: '[AADHAAR]' },
    // Nepal citizenship certificate numbers: district-year-… e.g. 27-01-72-12345
    { category: 'national_id', pattern: /(?<!\d|\d[.-])\d{2}-\d{2}-\d{2}-\d{3,6}(?!\d|[.-]\d)/g, replace: '[ID]' },
    { category: 'national_id', pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g, replace: '[PAN]' },
    { category: 'bank_account', pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g, replace: '[BANK_CODE]' },
    // Phone numbers: international (+977 98…), 10-digit mobile, 5-5 split, US 3-3-4, landline 0X-XXXXXXX.
    // Kept strict so lab values such as 4500000 /µL are not mistaken for phone numbers.
    { category: 'phone', pattern: /(?<!\d|\d\.)\+\d{1,3}[\s-]?\(?\d[\d\s()-]{7,13}\d(?!\d|\.\d)/g, replace: '[PHONE]' },
    {
        category: 'phone',
        pattern: /(?<!\d|\d[./])(?:\d{10}|\d{5}[\s-]\d{5}|\d{3}[\s-]\d{3}[\s-]\d{4}|0\d{1,2}-\d{6,7})(?!\d|[./]\d)/g,
        replace: '[PHONE]'
    },
    // --- Dates (all elements except the year alone) ---
    {
        category: 'date',
        pattern: /(?<!\d|\d[/.])(?:\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)\d{2}|(?:19|20)\d{2}[/.-]\d{1,2}[/.-]\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2})(?!\d|[/.]\d)/g,
        replace: '[DATE]'
    },
    {
        category: 'date',
        pattern: new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?[\\s-]+(?:of\\s+)?${MONTH}\\.?,?[\\s-]+(?:19|20)?\\d{2}\\b`, 'g'),
        replace: '[DATE]'
    },
    {
        category: 'date',
        pattern: new RegExp(`\\b${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+(?:19|20)\\d{2}\\b`, 'g'),
        replace: '[DATE]'
    },
    // Month + year ("March 2024") is still a date element under Safe Harbor
    { category: 'date', pattern: new RegExp(`\\b${MONTH}\\.?,?\\s+(?:19|20)\\d{2}\\b`, 'g'), replace: '[DATE]' },
    // --- Street addresses without a label: "12 MG Road", "Baneshwor Marg", "Ward No. 4, Lalitpur" ---
    {
        category: 'address',
        pattern: /\b(?:\d{1,5}[A-Za-z]?,?\s+)?(?:[A-Z][A-Za-z.'-]+\s+){1,3}(?:Road|Rd\.?|Street|St\.|Marg|Lane|Nagar|Colony|Chowk|Tole|Avenue|Ave\.?|Sadak|Galli|Gali|Bazaar|Bazar|Layout|Sector)\b/g,
        replace: '[ADDRESS]'
    },
    {
        category: 'address',
        pattern: /\bWard\s*(?:No\.?|Number)?\s*[:#-]?\s*\d{1,2}\s*,\s*[A-Z][A-Za-z]+(?:[ \t]+[A-Z][A-Za-z]+){0,2}/g,
        replace: '[ADDRESS]'
    }
];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Word boundary that also treats "_" and non-Latin letters (Devanagari etc.) correctly. */
const nameRegex = (name) => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escapeRegex(name).replace(/\s+/g, '[\\s_.-]+')}(?![\\p{L}\\p{M}\\p{N}])`, 'giu');
const TITLE_WORDS = /^(m\.?d\.?|mbbs|phd|dr|mr|mrs|ms|the|and|devi|kumar|kumari|bahadur|prasad)$/i;
/** Full names and distinctive name parts of the people this system knows. */
const namePieces = (knownNames) => {
    const parts = new Set();
    for (const full of knownNames) {
        if (!full)
            continue;
        const clean = full
            .replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?|miss)\s+/i, '')
            .replace(/,.*$/, '')
            .trim();
        if (clean.length < 3)
            continue;
        parts.add(clean);
        clean
            .split(/\s+/)
            // common middle names are only removed as part of the full name, so "Bahadur" alone
            // elsewhere in a report is not treated as a person
            .filter((p) => p.replace(/\./g, '').length >= 3 && !TITLE_WORDS.test(p))
            .forEach((p) => parts.add(p));
    }
    return [...parts].sort((a, b) => b.length - a.length);
};
/**
 * @param text raw report text
 * @param knownNames names we know belong to people in this system (patients, doctors) — removed anywhere they appear
 */
const deidentify = (text, knownNames = []) => {
    if (!text)
        return { text: '', redactions: 0, categories: [], categoryCounts: {} };
    let out = String(text).normalize('NFC');
    const counts = {};
    const hit = (category) => {
        counts[category] = (counts[category] || 0) + 1;
    };
    // 1. Emails first (so a name inside an address does not leave the domain behind)
    out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, () => {
        hit('email');
        return '[EMAIL]';
    });
    // 2. Known people — full name and each distinctive name part, in any script, also inside
    //    file names such as "Ram_Thapa_CBC.pdf"
    for (const p of namePieces(knownNames)) {
        out = out.replace(nameRegex(p), () => {
            hit('name');
            return '[NAME]';
        });
    }
    // 3. Pattern rules
    for (const rule of RULES) {
        out = out.replace(rule.pattern, (...args) => {
            const match = String(args[0]);
            // never count an already-redacted token twice, and respect rule-specific checks
            if (PLACEHOLDER.test(match.trim()))
                return match;
            if (rule.accept && !rule.accept(match))
                return match;
            // a labelled rule whose value is already a placeholder — leave as is
            const groups = args.slice(1, -2).filter((g) => typeof g === 'string');
            if (typeof rule.replace !== 'string' && PLACEHOLDER.test(match.slice((groups[0] || '').length + (groups[1] || '').length).trim())) {
                return match;
            }
            hit(rule.category);
            return typeof rule.replace === 'string' ? rule.replace : rule.replace(match, ...args.slice(1));
        });
    }
    // 4. A middle name left between two removed name parts ("[NAME] Bahadur [NAME]") belongs to the same person
    out = out.replace(/\[NAME\](?:[ \t]+[A-Z][A-Za-z'.-]*){1,2}[ \t]+\[NAME\]/g, '[NAME]');
    // 5. Collapse repeated placeholders such as "[NAME] [NAME]"
    out = out.replace(/(\[[A-Z_]+\])(?:[\s_,.-]+\1)+/g, '$1');
    const redactions = Object.values(counts).reduce((a, b) => a + b, 0);
    return { text: out, redactions, categories: Object.keys(counts), categoryCounts: counts };
};
exports.deidentify = deidentify;
/** De-identifies every string inside a JSON-like value (object keys are kept). */
const deidentifyValue = (value, knownNames = []) => {
    if (typeof value === 'string')
        return (0, exports.deidentify)(value, knownNames).text;
    if (Array.isArray(value))
        return value.map((v) => (0, exports.deidentifyValue)(v, knownNames));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, (0, exports.deidentifyValue)(v, knownNames)]));
    }
    return value;
};
exports.deidentifyValue = deidentifyValue;
// ---------------------------------------------------------------------------
// Independent verification (fail-closed gate)
// ---------------------------------------------------------------------------
const DETECTORS = [
    { category: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
    { category: 'url', pattern: /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi },
    { category: 'wallet', pattern: /\b0x[a-fA-F0-9]{40}\b/g },
    { category: 'payment_card', pattern: /(?<!\d|\d\.)(?:\d{13,19}|\d{4}([ -])\d{4}\1\d{4}\1\d{1,4}|\d{4}([ -])\d{6}\2\d{5})(?!\d|\.\d)/g, accept: luhn },
    { category: 'national_id', pattern: /(?<!\d|\d\.)\d{4}[\s-]\d{4}[\s-]\d{4}(?!\d|\.\d)/g },
    { category: 'national_id', pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
    { category: 'national_id', pattern: /(?<!\d|\d[.-])\d{2}-\d{2}-\d{2}-\d{3,6}(?!\d|[.-]\d)/g },
    { category: 'phone', pattern: /(?<!\d|\d\.)\+\d{1,3}[\s-]?\d[\d\s-]{7,13}\d(?!\d|\.\d)/g },
    { category: 'phone', pattern: /(?<!\d|\d[./])(?:\d{10}|\d{5}[\s-]\d{5})(?!\d|[./]\d)/g },
    { category: 'ip_address', pattern: /(?<!\d|\d\.)(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?!\d|\.\d)/g },
    { category: 'date', pattern: /(?<!\d|\d[/.])\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)\d{2}(?!\d|[/.]\d)/g },
    { category: 'date', pattern: /(?<!\d)(?:19|20)\d{2}-\d{2}-\d{2}(?:T[\d:.]+Z?)?(?!\d)/g }
];
/**
 * Looks for identifiers that should never reach an external service. Independent of the
 * redaction rules above, so a gap in one is caught by the other. Returns categories and counts only.
 */
const scanForPII = (text, knownNames = []) => {
    if (!text)
        return [];
    const counts = {};
    for (const d of DETECTORS) {
        for (const m of text.match(d.pattern) || []) {
            if (d.accept && !d.accept(m))
                continue;
            counts[d.category] = (counts[d.category] || 0) + 1;
        }
    }
    for (const n of namePieces(knownNames)) {
        const found = text.match(nameRegex(n));
        if (found)
            counts.name = (counts.name || 0) + found.length;
    }
    return Object.entries(counts).map(([category, count]) => ({ category, count }));
};
exports.scanForPII = scanForPII;
/** True when text still appears to contain obvious identifiers (used to validate AI input and output). */
const containsObviousPII = (text, knownNames = []) => (0, exports.scanForPII)(text, knownNames).length > 0;
exports.containsObviousPII = containsObviousPII;
