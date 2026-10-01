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
import { DEVANAGARI_HONORIFICS, DEVANAGARI_NAME_LABELS, GIVEN_SET, SURNAME_SET } from './commonNames.js';

export interface DeidentifyResult {
  text: string;
  redactions: number;
  categories: string[];
  /** How many items were removed per category — safe to log/audit (contains no values). */
  categoryCounts: Record<string, number>;
}

export interface PiiFinding {
  category: string;
  count: number;
}

type Replacer = (match: string, ...groups: string[]) => string;

interface Rule {
  category: string;
  pattern: RegExp;
  replace: string | Replacer;
  /** optional extra check on the matched text (e.g. Luhn for card numbers) */
  accept?: (match: string) => boolean;
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/**
 * "Label: value" style identifiers — keep the label, drop the value.
 * `sepOptional` is only used for numeric values (age, DOB, IDs, phone) so "Age 21" is caught
 * without turning ordinary words after labels such as "Registration of…" into redactions.
 */
const labelled = (labels: string, valuePattern: string, tag: string, category: string, sepOptional = false): Rule => ({
  category,
  pattern: new RegExp(
    `(?<![A-Za-z])(${labels})(?![A-Za-z])(\\s*(?:[:#=\\-]|no\\.?|number)${sepOptional ? '?' : ''}\\s*(?:[:#=\\-]\\s*)?)${valuePattern}`,
    'gi'
  ),
  replace: (_m: string, label: string, sep: string) => `${label}${sep}[${tag}]`
});

// name words are separated by ONE space: a wider gap starts the next column ("Meena Rai    Age/Sex: 47/F"),
// and a word that is itself a label ("Age/", "Sex:") is never part of the name
const NAME = "[A-Z][A-Za-z'.-]*(?:[ \\t](?![A-Za-z'.-]*[/:])[A-Z][A-Za-z'.-]*){0,3}";
const NAME_CI = "[A-Za-z][A-Za-z'.-]+(?:[ \\t](?![A-Za-z'.-]*[/:])[A-Za-z][A-Za-z'.-]*){0,3}";
const MONTH =
  '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const PLACEHOLDER = /^\[[A-Z_]+\]$/;

/** Luhn checksum — distinguishes real card numbers from other long digit strings. */
const luhn = (raw: string): boolean => {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
};

// ---------------------------------------------------------------------------
// Rules — order matters: specific before generic, long numbers before short ones.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Phase 9 – names without a label
// ---------------------------------------------------------------------------
const RELATION = 'son|daughter|husband|wife|mother|father|brother|sister|uncle|aunt|grandson|granddaughter|grandmother|grandfather|relative|guardian|attendant|neighbour|neighbor|friend|nurse|technician|technologist|phlebotomist|colleague';
/** A cue phrase, an optional "her husband," and an optional title, before a capitalised name. */
const CUE =
  `((?:\\b(?:[Aa]ccompanied|[Aa]ttended|[Cc]ollected|[Dd]rawn|[Ss]een|[Ee]xamined|[Ee]scorted|[Bb]rought|[Rr]eviewed|[Cc]alled|[Ss]igned|[Rr]eceived|[Pp]repared|[Tt]yped|[Bb]rought[ \t]+in)[ \t]+by|\\b(?:[Ss]poke|[Tt]alked|[Mm]et|[Ss]een|[Cc]ounselled|[Cc]ounseled)[ \t]+(?:with|to)|\\b[Dd]iscussed[ \t]+with|\\b[Rr]eviewed[ \t]+with|\\b[Ee]xplained[ \t]+to|\\b[Hh]anded[ \t]+(?:over[ \t]+)?to|\\b[Ii]nformed)` +
  `[ \t]+(?:(?:her|his|their|the|patient's)[ \t]+)?(?:(?:${RELATION})[ \t]*,?[ \t]+)?(?:(?:Dr|Mr|Mrs|Ms|Miss)\\.?[ \t]*)?)`;
/** Either case for the first letter: "son" and "Son". */
const ci = (words: string) => words.split('|').map((w) => `[${w[0].toUpperCase()}${w[0].toLowerCase()}]${w.slice(1)}`).join('|');
/**
 * A family member or a staff role written just before a name: "mother Bhagwati Luitel", "her son, Rupesh",
 * "Husband (Dilliram Rijal)", "Nurse on duty: Kopila Wagle", "Lab technologist Samjhana Aryal".
 */
const ROLE =
  ci('son|daughter|husband|wife|mother|father|brother|sister|uncle|aunt|nephew|niece|cousin|grandson|granddaughter|grandmother|grandfather|guardian|relative|neighbour|neighbor|friend|spouse|partner|escort|bystander|attendant|caretaker|caregiver|nurse|phlebotomist|technologist|technician|assistant|in-charge|incharge|contact person') +
  '|MLT|CMA|ANM';
const ROLE_BEFORE_NAME = `\\b((?:${ROLE})(?:-in-law)?(?:[ \\t]+on[ \\t]+duty)?)([ \\t]*[:\\-–][ \\t]*|,?[ \\t]+|[ \\t]*\\([ \\t]*)`;
/**
 * Keeps headings such as "Relative Risk Reduction", "Nurse Practitioner" or "Lab Assistant: Hemoglobin":
 * after a colon, dash or bracket the value must be two name-like words (or a listed name); after a
 * space or comma the role word must be lower case, as in running text ("her mother Bhagwati Luitel").
 */
const roleNameOk = (role: string, sep: string, name: string): boolean => {
  const words = name.split(/[ \t]+/).filter(Boolean);
  if (words.some((w) => NOT_NAME.has(w.toLowerCase()))) return false;
  if (/[:\-–(]/.test(sep)) return words.length >= 2 || words.some(listed);
  return /^[a-z]/.test(role);
};
/** A name opening a sentence and followed by an age: "Tulasa Bhusal, 34, attended …", "Hikmat Rai, aged 58". */
const NAME_THEN_AGE = /(?<![\p{L}\[])(\p{Lu}\p{Ll}+(?:[ \t]\p{Lu}\p{Ll}+){1,2})(?=,[ \t]*(?:aged[ \t]+)?\d{1,3}(?:[ \t]*(?:y|yrs|years?)\b|[ \t]*[,/]))/gu;
const DEV = '[\\u0900-\\u097F\\u200C\\u200D]+';
const DEV_WORDS = (max: number) => `${DEV}(?:[ \\t]+${DEV}){0,${max - 1}}`;
const byLength = (xs: string[]) => [...xs].sort((a, b) => b.length - a.length).map((x) => x.replace(/\./g, '\\.')).join('|');
const DEV_LABEL = byLength(DEVANAGARI_NAME_LABELS);
const DEV_HONORIFIC = byLength(DEVANAGARI_HONORIFICS);

/** Capitalised words that start a phrase but are not names ("Patient Sita Rai" keeps "Patient"). */
const NOT_NAME = new Set(
  ('patient pt name doctor dr mr mrs ms miss the a an and of to in on at for with by from report reported result results test tests ' +
    'impression advice advised remarks note notes sample collected consultant pathologist nurse case findings review repeat ' +
    'normal abnormal high low blood serum urine fasting random total age sex male female date phone email address ward bed ' +
    'team department unit ward icu opd emergency cardiology medicine surgery neurology nephrology oncology orthopaedics orthopedics paediatrics pediatrics gynaecology obstetrics radiology pathology dermatology psychiatry physiotherapy ' +
    'worker workers volunteer puja jayanti dashain tihar temple mandir chowk hospital clinic lab laboratory centre center diagnostic diagnostics medical teaching health road marg chowk nagar colony bazaar ' +
    'january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday')
    .split(/\s+/)
);
const listed = (w: string) => GIVEN_SET.has(w.toLowerCase()) || SURNAME_SET.has(w.toLowerCase());

/**
 * Names this document itself gives in a labelled place ("Patient Name: Sita Rai", "Dr. Hari Karki",
 * "नाम: सीता राई", "accompanied by her son Ram"). Every other mention of those names in the same
 * document — "Sita is a 51-year-old …" — is then removed too.
 */
const HARVEST: RegExp[] = [
  /\b(?:Patient(?:'s)?\s*Name|Name of (?:the )?Patient|(?<!(?:Test|Drug|Medicine|Brand|Generic|Investigation|Parameter|Product|File|User|Sample)[ \t])Name|Informant|Next of Kin|Guardian|Attendant|Caregiver|Emergency Contact|Father(?:'s Name)?|Mother(?:'s Name)?|Husband(?:'s Name)?|Wife(?:'s Name)?|Spouse)[ \t]*[:\-][ \t]*([A-Za-z][A-Za-z'.-]+(?:[ \t][A-Za-z][A-Za-z'.-]+){0,3})/gi,
  /\b(?:Dr|Mr|Mrs|Ms|Miss|Shri|Shree|Smt|S\/o|D\/o|W\/o|C\/o)\.?[ \t]*([A-Z][A-Za-z'-]+(?:[ \t][A-Z][A-Za-z'-]+){0,2})/g,
  /\b(?:Referred|Reported|Verified|Checked|Signed)[ \t]+by[ \t]*[:\-]?[ \t]*(?:Dr\.?[ \t]*)?([A-Z][A-Za-z'-]+(?:[ \t][A-Z][A-Za-z'-]+){0,2})/g
];
const harvestNames = (text: string): string[] => {
  const found: string[] = [];
  const keep = (value: string) => {
    const words = value.split(/[.;,](?:[ \t]|$)/)[0].split(/[ \t]+/).filter((w) => /^\p{Lu}/u.test(w) && w.replace(/[.'-]/g, '').length >= 3 && !NOT_NAME.has(w.toLowerCase().replace(/\.$/, '')));
    if (words.length) found.push(words.join(' '));
  };
  for (const re of HARVEST) for (const m of text.matchAll(re)) keep(m[1]);
  for (const m of text.matchAll(new RegExp(`${CUE}([A-Z][A-Za-z'-]+(?:[ \\t][A-Z][A-Za-z'-]+){0,2})`, 'g'))) keep(m[2]);
  for (const m of text.matchAll(new RegExp(`${ROLE_BEFORE_NAME}([A-Z][A-Za-z'-]+(?:[ \\t][A-Z][A-Za-z'-]+){0,2})`, 'g'))) if (roleNameOk(m[1], m[2], m[3])) keep(m[3]);
  for (const m of text.matchAll(NAME_THEN_AGE)) keep(m[1]);
  for (const m of text.matchAll(new RegExp(`(?<![\\p{L}\\p{M}])(?:${DEV_LABEL})[ \\t]*[:：\\-][ \\t]*(${DEV_WORDS(4)})`, 'gu'))) found.push(m[1]);
  for (const m of text.matchAll(new RegExp(`(?<![\\p{L}\\p{M}])(?:${DEV_HONORIFIC})[ \\t]*(${DEV_WORDS(2)})`, 'gu'))) found.push(m[1]);
  return found;
};

const RULES: Rule[] = [
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
  labelled(
    'Citizenship(?: Certificate)?(?: No)?|Nagarikta|Passport|Voter ID|Voter|EPIC|Driving Licen[cs]e|DL',
    '[A-Z0-9][A-Z0-9 /-]{3,20}[A-Z0-9]',
    'ID',
    'national_id'
  ),
  labelled(
    'MRN|UHID|IPD|OPD|IP No|OP No|Hospital No|Hospital ID|Registration|Reg|Patient ID|Patient No|Lab No|Lab ID|Sample ID|Sample No|Specimen ID|Barcode|Accession|Bed No|Case No|Visit ID|Encounter',
    '[A-Z0-9][A-Z0-9-/]{1,}',
    'ID',
    'record_id'
  ),
  labelled(
    'Policy|Policy No|Insurance|Insurance ID|Member ID|Claim|Claim No|TPA ID|Beneficiary ID|SSF ID',
    '[A-Z0-9][A-Z0-9-/]{3,}',
    'POLICY',
    'insurance_id'
  ),
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
  labelled(
    'Address|Addr|Residence|Resident of|Permanent Address|Temporary Address|Present Address|Lives at|Residing at',
    '[^\\n]{3,80}',
    'ADDRESS',
    'address'
  ),
  // "resident of Baneshwor", "lives in Pokhara" — place names after these phrases (value must be capitalised)
  {
    category: 'address',
    pattern: /\b((?:[Rr]esident|[Rr]esiding|[Ll]iv(?:es|ing)|[Ss]tays?|[Ss]taying)\s+(?:of|at|in)|[Hh]ails from|[Nn]ative of)(\s+)([A-Z][A-Za-z'-]+(?:[ \t]+[A-Z][A-Za-z'-]+){0,3}(?:,[ \t]*[A-Z][A-Za-z'-]+(?:[ \t]+[A-Z][A-Za-z'-]+){0,2})?)/g,
    replace: (_m: string, label: string, sep: string) => `${label}${sep}[ADDRESS]`
  },
  labelled('House|Flat|Plot|Apartment|Apt', '[A-Za-z0-9][A-Za-z0-9/-]{0,8}', 'ADDRESS', 'address'),
  labelled('Phone|Ph|Mobile|Mob|Contact|Tel|Telephone|Cell|WhatsApp|Fax', '\\+?[\\d][\\d\\s()-]{6,16}\\d', 'PHONE', 'phone', true),

  // --- Names ---
  // Names after a label: "Patient: John Doe", "Name - jane doe" (a colon or dash is required so
  // ordinary sentences like "Patient presents with…" are left alone)
  {
    category: 'name',
    pattern: new RegExp(
      `\\b(Patient(?:'s)?\\s*Name|Name of (?:the )?Patient|Patient|(?<!(?:Test|Drug|Medicine|Brand|Generic|Investigation|Parameter|Product|File|User|Sample)\\s)Name|Pt\\.?|Guardian|Father(?:'s Name)?|Mother(?:'s Name)?|Husband(?:'s Name)?|Wife(?:'s Name)?|Spouse|Next of Kin|Attendant|Informant|Emergency Contact|Caregiver|Insured|Policy Holder|Beneficiary)(\\s*[:\\-]\\s*)(${NAME_CI})`,
      'gi'
    ),
    replace: (_m: string, label: string, sep: string) => `${label}${sep}[NAME]`
  },
  // Relation forms common in Nepal / India: "S/o Hari Bahadur", "W/o Ram", "C/o Sita Devi", "son of …"
  {
    category: 'name',
    pattern: new RegExp(`\\b(S/o|D/o|W/o|C/o|H/o|son of|daughter of|wife of|husband of)(\\.?\\s*)(${NAME_CI})`, 'gi'),
    replace: (_m: string, label: string, sep: string) => `${label}${sep}[NAME]`
  },
  // Honorifics followed by a capitalised name: "Mr. Ram Bahadur", "Dear Sita"
  {
    category: 'name',
    pattern: new RegExp(`\\b(Mr|Mrs|Ms|Miss|Mx|Master|Shri|Shree|Smt|Sushri|Kumari|Dear)(\\.?\\s+)(${NAME})`, 'g'),
    replace: (_m: string, label: string, sep: string) => `${label}${sep}[NAME]`
  },
  // Phase 9 – a person named after a cue phrase, without a label: "accompanied by her husband Ram Thapa",
  // "sample collected by Sita Rai", "discussed with Dr. …", "result explained to his son, Hari"
  {
    category: 'name',
    pattern: new RegExp(`${CUE}(${NAME})`, 'g'),
    replace: (m: string, cue: string, name: string) => (name.split(/[ \t]+/).some((w) => NOT_NAME.has(w.toLowerCase())) ? m : `${cue}[NAME]`)
  },
  {
    category: 'name',
    pattern: new RegExp(`${ROLE_BEFORE_NAME}(${NAME})`, 'g'),
    replace: (m: string, role: string, sep: string, name: string) => (roleNameOk(role, sep, name) ? `${role}${sep}[NAME]` : m)
  },
  { category: 'name', pattern: NAME_THEN_AGE, replace: '[NAME]', accept: (m) => !m.split(/[ \t]+/).some((w) => NOT_NAME.has(w.toLowerCase())) },
  // names written in Devanagari after a label ("नाम: सीता तामाङ") or an honorific ("श्रीमती …")
  {
    category: 'name',
    pattern: new RegExp(`(?<![\\p{L}\\p{M}])(${DEV_LABEL})([ \\t]*[:：\\-][ \\t]*)(${DEV_WORDS(4)})`, 'gu'),
    replace: (_m: string, label: string, sep: string) => `${label}${sep}[NAME]`
  },
  {
    category: 'name',
    pattern: new RegExp(`(?<![\\p{L}\\p{M}])(${DEV_HONORIFIC})([ \\t]*)(${DEV_WORDS(2)})`, 'gu'),
    replace: (_m: string, label: string, sep: string) => `${label}${sep}[NAME]`
  },
  {
    category: 'clinician_name',
    pattern: new RegExp(
      `\\b(Referred by|Ref\\. by|Ref by|Consultant|Physician|Attending|Signed by|Reported by|Verified by|Checked by|Pathologist|Radiologist|Technician|Treating Doctor|Doctor|Dr\\.?)(\\s*[:\\-]?\\s*)(?:Dr\\.?\\s*)?(${NAME})`,
      'g'
    ),
    replace: (_m: string, label: string, sep: string) => `${label}${sep}[CLINICIAN]`
  },
  // Facility after a label ("Hospital: Bir Hospital") or a capitalised facility name ("Grande City Hospital")
  {
    category: 'facility',
    pattern: new RegExp(
      `\\b(Hospital|Clinic|Facility|Laboratory|Lab Name|Institution|Centre|Center|Collected at|Sample collected at)(\\s*[:\\-]\\s*)(${NAME_CI})`,
      'gi'
    ),
    replace: (_m: string, label: string, sep: string) => `${label}${sep}[FACILITY]`
  },
  {
    category: 'facility',
    pattern:
      /\b(?:[A-Z][A-Za-z&'.-]+\s+){1,4}(?:Hospital|Clinic|Polyclinic|Diagnostics|Diagnostic Cent(?:re|er)|Diagnostic Labs?|Pathology Labs?|Laborator(?:y|ies)|Medical College|Teaching Hospital|Nursing Home|Health ?care|Health Post|Medical Cent(?:re|er)|Poly Clinic)\b/g,
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
    pattern:
      /(?<!\d|\d[/.])(?:\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)\d{2}|(?:19|20)\d{2}[/.-]\d{1,2}[/.-]\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2})(?!\d|[/.]\d)/g,
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
    pattern:
      /\b(?:\d{1,5}[A-Za-z]?,?\s+)?(?:[A-Z][A-Za-z.'-]+\s+){1,3}(?:Road|Rd\.?|Street|St\.|Marg|Lane|Nagar|Colony|Chowk|Tole|Avenue|Ave\.?|Sadak|Galli|Gali|Bazaar|Bazar|Layout|Sector)\b/g,
    replace: '[ADDRESS]'
  },
  {
    category: 'address',
    pattern: /\bWard\s*(?:No\.?|Number)?\s*[:#-]?\s*\d{1,2}\s*,\s*[A-Z][A-Za-z]+(?:[ \t]+[A-Z][A-Za-z]+){0,2}/g,
    replace: '[ADDRESS]'
  }
];

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Word boundary that also treats "_" and non-Latin letters (Devanagari etc.) correctly. */
const nameRegex = (name: string): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escapeRegex(name).replace(/\s+/g, '[\\s_.-]+')}(?![\\p{L}\\p{M}\\p{N}])`, 'giu');

const TITLE_WORDS = /^(m\.?d\.?|mbbs|phd|dr|mr|mrs|ms|the|and|devi|kumar|kumari|bahadur|prasad)$/i;

/** Full names and distinctive name parts of the people this system knows. */
const namePieces = (knownNames: string[]): string[] => {
  const parts = new Set<string>();
  for (const full of knownNames) {
    if (!full) continue;
    const clean = full
      .replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?|miss)\s+/i, '')
      .replace(/,.*$/, '')
      .trim();
    if (clean.length < 3) continue;
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


// ---------------------------------------------------------------------------
// Stricter checks for OCR text (Phase 6): OCR turns "Bhattarai" into "Bhattara1" and
// "meena@" into "rneena@", which exact patterns miss.
// ---------------------------------------------------------------------------

/** Common OCR confusions, folded before comparing a word with a known name. */
const foldOcr = (w: string): string =>
  w
    .toLowerCase()
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w')
    .replace(/[1|!]/g, 'l')
    .replace(/0/g, 'o')
    .replace(/5/g, 's')
    .replace(/8/g, 'b')
    .replace(/[^a-z]/g, '');

/** Edit distance, stopping early once it exceeds `max`. */
const withinDistance = (a: string, b: string, max: number): boolean => {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
};

/** Single-word name parts long enough to match fuzzily (short parts would hit ordinary words). */
const fuzzyTargets = (knownNames: string[]): string[] =>
  [...new Set(namePieces(knownNames).filter((p) => !/\s/.test(p)).map(foldOcr).filter((p) => p.length >= 5))];

/**
 * Words that look like a known name after OCR damage: 5–7 letters within 1 edit, 8+ within 2.
 * A word starting in lower case (OCR often loses the capital, as in e-mail addresses) must be
 * closer: the same letters, or one edit for names of 6+ letters.
 */
const fuzzyNameWord = (word: string, targets: string[]): boolean => {
  const f = foldOcr(word);
  if (f.length < 5) return false;
  const capital = /^[A-Z0-9]/.test(word);
  return targets.some((t) => (capital ? withinDistance(f, t, t.length >= 8 ? 2 : 1) : f === t || (t.length >= 6 && withinDistance(f, t, 1))));
};

/** Labels whose value is always personal, matched even when OCR misspells them ("Adress", "Referiec. by"). */
const PERSONAL_LABELS: Array<{ label: string; placeholder: string; category: string }> = [
  { label: 'patient name', placeholder: '[NAME]', category: 'name' },
  { label: 'name', placeholder: '[NAME]', category: 'name' },
  { label: 'address', placeholder: '[ADDRESS]', category: 'address' },
  { label: 'phone', placeholder: '[PHONE]', category: 'phone' },
  { label: 'mobile', placeholder: '[PHONE]', category: 'phone' },
  { label: 'email', placeholder: '[EMAIL]', category: 'email' },
  { label: 'referred by', placeholder: '[CLINICIAN]', category: 'clinician_name' },
  { label: 'reported by', placeholder: '[CLINICIAN]', category: 'clinician_name' },
  { label: 'verified by', placeholder: '[CLINICIAN]', category: 'clinician_name' },
  { label: 'consultant', placeholder: '[CLINICIAN]', category: 'clinician_name' }
];
const foldLabel = (l: string): string => l.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const personalLabel = (raw: string) => {
  const l = foldLabel(raw);
  if (l.length < 4) return undefined;
  // "... by" lines (referred / reported / verified / checked by) always name a person
  if (/\b[bd][yv]$/.test(l)) return PERSONAL_LABELS.find((p) => p.label === 'referred by');
  return PERSONAL_LABELS.find((p) => withinDistance(l, p.label, p.label.length >= 7 ? 2 : 1));
};

/**
 * The part of a labelled value that is personal: at most `max` words, and never past a bracket or
 * a sentence end ("Dr. A. Cameron (License …). HbA1c 7.1 %" keeps everything after the name).
 */
const capValue = (value: string, max: number): { masked: string; rest: string } => {
  // stop at a bracket, or where a new sentence starts with a test or label ("… Cameron. HbA1c 7.1 %", "…. SpO2 91%")
  const stop = value.search(/[(]|[.;][ \t]+(?=[A-Z][A-Za-z0-9]{1,}[ \t]*[\p{L}\d]*[ \t]*[:\d])/u);
  let head = stop >= 0 ? value.slice(0, stop) : value;
  let rest = stop >= 0 ? value.slice(stop) : '';
  const words = head.split(/([ \t]+)/);
  if (words.filter((w) => w.trim()).length > max) {
    let seen = 0;
    let cut = words.length;
    for (let i = 0; i < words.length; i++) if (words[i].trim() && ++seen > max) { cut = i; break; }
    rest = words.slice(cut - 1).join('') + rest;
    head = words.slice(0, cut - 1).join('');
  }
  return { masked: head, rest: rest ? (/^[ \t]/.test(rest) ? rest : ` ${rest}`) : '' };
};

/** Facility words, matched with OCR damage ("Diegnostic", "Hospita1"). */
const FACILITY_WORDS = ['hospital', 'clinic', 'polyclinic', 'diagnostic', 'diagnostics', 'laboratory', 'centre', 'center', 'pathology', 'nursing', 'healthcare'];
const facilityWord = (w: string): boolean => {
  const f = foldOcr(w);
  if (f === 'lab' || f === 'labs') return true;
  return f.length >= 6 && FACILITY_WORDS.some((t) => withinDistance(f, t, 2));
};

/**
 * Seven or more digits in a row (OCR may read some as O, l, I or S) — an ID or phone number.
 * A count followed by a unit ("RBC 4500000 /uL", "250000 cells/mm3") is a lab value and is kept.
 */
const LONG_NUMBER =
  /(?<![\p{L}\d]|\d[.,/])(?=(?:[OlIS]*\d){7})[\dOlIS]{7,}(?![\p{L}\d]|[.,/]\d|[ \t]*(?:\/|x[ \t]*10|×|cells|cumm|cu\.?[ \t]*mm|mm3|µl|ul|per\b|lakh))/giu;
/** Anything shaped like an e-mail address, even with the dot before the domain lost. */
const EMAIL_LIKE = /[\p{L}\d._%+-]{2,}@[\p{L}\d._-]{2,}(?:[ \t]*(?:\.|,)?[ \t]*(?:com|net|org|in|np|co|edu|gov)\b)?/giu;

/**
 * @param text raw report text
 * @param knownNames names we know belong to people in this system (patients, doctors) — removed anywhere they appear
 */
export const deidentify = (text: string, knownNames: string[] = []): DeidentifyResult => {
  if (!text) return { text: '', redactions: 0, categories: [], categoryCounts: {} };

  let out = String(text).normalize('NFC');
  const counts: Record<string, number> = {};
  const hit = (category: string) => {
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

  // 2b. Names the document itself labels, removed wherever else they appear in it (Phase 9)
  for (const p of namePieces(harvestNames(String(text).normalize('NFC')))) {
    out = out.replace(nameRegex(p), () => {
      hit('name');
      return '[NAME]';
    });
  }

  // 3. Pattern rules
  for (const rule of RULES) {
    out = out.replace(rule.pattern, (...args: unknown[]) => {
      const match = String(args[0]);
      // never count an already-redacted token twice, and respect rule-specific checks
      if (PLACEHOLDER.test(match.trim())) return match;
      if (rule.accept && !rule.accept(match)) return match;
      // a labelled rule whose value is already a placeholder — leave as is
      const groups = args.slice(1, -2).filter((g) => typeof g === 'string') as string[];
      if (typeof rule.replace !== 'string' && PLACEHOLDER.test(match.slice((groups[0] || '').length + (groups[1] || '').length).trim())) {
        return match;
      }
      hit(rule.category);
      return typeof rule.replace === 'string' ? rule.replace : (rule.replace as Replacer)(match, ...(args.slice(1) as string[]));
    });
  }

  // 4. A middle name left between two removed name parts ("[NAME] Bahadur [NAME]") belongs to the same person
  out = out.replace(/\[NAME\](?:[ \t]+[A-Z][A-Za-z'.-]*){1,2}[ \t]+\[NAME\]/g, '[NAME]');

  // 4a. A surname left after a removed given name ("[NAME] Karki": a relative who shares the patient's first name)
  out = out.replace(/\[NAME\] ((?:\p{Lu}\p{Ll}+)(?: \p{Lu}\p{Ll}+)?)(?![\p{L}\/:])/gu, (m, rest: string) =>
    rest.split(' ').some((w) => NOT_NAME.has(w.toLowerCase())) ? m : '[NAME]'
  );

  // 4b. A clinician who shares a first name with the patient: "Dr. [NAME] Karki" → "Dr. [CLINICIAN]"
  out = out.replace(/(\bDr\.?[ \t]*|\[CLINICIAN\][ \t]*)\[NAME\](?:[ \t]+[A-Z][A-Za-z'.-]+){0,2}/g, (m) => {
    hit('clinician_name');
    return m.startsWith('[CLINICIAN]') ? '[CLINICIAN]' : 'Dr. [CLINICIAN]';
  });

  // 4c. OCR-damaged versions of the same things
  // a labelled field whose (possibly misspelt) label is personal: mask the value up to the next label or the line end
  out = out.replace(/^([^\n:;]{2,24}?)[ \t]*[:;][ \t]*([^\n]*?)(?=[ \t]+[A-Za-z][\w./-]{2,15}[ \t]*:|$)/gm, (m, label: string, value: string) => {
    const p = personalLabel(label);
    if (!p) return m;
    const { masked, rest } = capValue(value, p.placeholder === '[ADDRESS]' ? 7 : p.placeholder === '[CLINICIAN]' || p.placeholder === '[NAME]' ? 6 : 3);
    if (!masked.replace(/\[[A-Z_]+\]/g, '').replace(/[^\p{L}\d]/gu, '')) return m;
    hit(p.category);
    return `${label}: ${p.placeholder}${rest}`;
  });
  // the same for a label in the middle of a line ("... Age: 47  Referred by: Dr. X")
  out = out.replace(/(\b[A-Za-z][A-Za-z.]{1,12}[ \t]+[bd][yv])[ \t]*[:;][ \t]*([^\n]*?)(?=[ \t]+[A-Za-z][\w./-]{2,15}[ \t]*:|$)/gm, (m, label: string, value: string) => {
    const { masked, rest } = capValue(value, 6);
    if (!masked.replace(/\[[A-Z_]+\]/g, '').replace(/[^\p{L}\d]/gu, '')) return m;
    hit('clinician_name');
    return `${label}: [CLINICIAN]${rest}`;
  });
  // "Dr." misread as "Or.", "Di.", "Dt." before a name
  out = out.replace(/\b(?:D[tf1i]|[O0Q]r)\.[ \t]*\p{L}[\p{L}.'‘’-]*(?:[ \t]+\p{L}[\p{L}.'‘’-]*)?/gu, () => {
    hit('clinician_name');
    return 'Dr. [CLINICIAN]';
  });
  // a short line that ends in a facility word is the facility's name ("City Diegnostic Lab")
  out = out.replace(/^[ \t]*((?:[^\s\[\]]+[ \t]+){1,4}[^\s:;\[\]]+)[ \t]*$/gm, (m, line: string) => {
    const words = line.split(/\s+/);
    if (!facilityWord(words[words.length - 1]) || !/[A-Z]/.test(line)) return m;
    hit('facility');
    return '[FACILITY]';
  });
  out = out.replace(EMAIL_LIKE, (m) => (PLACEHOLDER.test(m) ? m : (hit('email'), '[EMAIL]')));
  out = out.replace(LONG_NUMBER, () => {
    hit('id_number');
    return '[ID]';
  });
  const targets = fuzzyTargets(knownNames);
  if (targets.length) {
    out = out.replace(/(?<![\p{L}\p{N}])[\p{L}\d|!]{5,}(?![\p{L}\p{N}])/gu, (w) => {
      if (!fuzzyNameWord(w, targets)) return w;
      hit('name');
      return '[NAME]';
    });
  }

  // 4d. Two or three capitalised words, at least one a common Nepali or Indian name ("… with Sita Tamang")
  out = out.replace(/(?<![\p{L}\[])(\p{Lu}\p{Ll}+)((?:[ \t]+\p{Lu}\p{Ll}+){1,2})(?![\p{L}\]])/gu, (m) => {
    const words = m.split(/([ \t]+)/);
    let start = 0;
    while (start < words.length && (NOT_NAME.has(words[start].toLowerCase()) || !words[start].trim())) start++;
    const name = words.slice(start).filter((w) => w.trim());
    if (name.length < 2 || name.some((w) => NOT_NAME.has(w.toLowerCase())) || !name.some(listed)) return m;
    hit('name');
    return `${words.slice(0, start).join('')}[NAME]`;
  });

  // 5. Collapse repeated placeholders such as "[NAME] [NAME]"
  out = out.replace(/(\[[A-Z_]+\])(?:[\s_,.-]+\1)+/g, '$1');

  const redactions = Object.values(counts).reduce((a, b) => a + b, 0);
  return { text: out, redactions, categories: Object.keys(counts), categoryCounts: counts };
};

/** De-identifies every string inside a JSON-like value (object keys are kept). */
export const deidentifyValue = <T>(value: T, knownNames: string[] = []): T => {
  if (typeof value === 'string') return deidentify(value, knownNames).text as unknown as T;
  if (Array.isArray(value)) return value.map((v) => deidentifyValue(v, knownNames)) as unknown as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, deidentifyValue(v, knownNames)])
    ) as T;
  }
  return value;
};

// ---------------------------------------------------------------------------
// Independent verification (fail-closed gate)
// ---------------------------------------------------------------------------

const DETECTORS: Array<{ category: string; pattern: RegExp; accept?: (m: string) => boolean }> = [
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
export const scanForPII = (text: string, knownNames: string[] = []): PiiFinding[] => {
  if (!text) return [];
  const counts: Record<string, number> = {};
  for (const d of DETECTORS) {
    for (const m of text.match(d.pattern) || []) {
      if (d.accept && !d.accept(m)) continue;
      counts[d.category] = (counts[d.category] || 0) + 1;
    }
  }
  for (const n of namePieces(knownNames)) {
    const found = text.match(nameRegex(n));
    if (found) counts.name = (counts.name || 0) + found.length;
  }
  // OCR-damaged identifiers
  const emailLike = (text.match(EMAIL_LIKE) || []).length;
  if (emailLike > (counts.email || 0)) counts.email = emailLike;
  // long numbers not already counted as a phone, card or ID above
  const known = (m: string) => DETECTORS.some((d) => new RegExp(d.pattern.source, d.pattern.flags.replace('g', '')).test(m));
  const longNumbers = (text.match(LONG_NUMBER) || []).filter((m) => !known(m));
  if (longNumbers.length) counts.id_number = (counts.id_number || 0) + longNumbers.length;
  const targets = fuzzyTargets(knownNames);
  if (targets.length) {
    const fuzzy = (text.match(/(?<![\p{L}\p{N}])[\p{L}\d|!]{5,}(?![\p{L}\p{N}])/gu) || []).filter((w) => fuzzyNameWord(w, targets));
    if (fuzzy.length) counts.name = (counts.name || 0) + fuzzy.length;
  }
  return Object.entries(counts).map(([category, count]) => ({ category, count }));
};

/** True when text still appears to contain obvious identifiers (used to validate AI input and output). */
export const containsObviousPII = (text: string, knownNames: string[] = []): boolean => scanForPII(text, knownNames).length > 0;
