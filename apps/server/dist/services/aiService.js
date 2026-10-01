"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiService = exports.AIService = exports.softenLanguage = exports.DISCLAIMER = void 0;
const crypto_1 = __importDefault(require("crypto"));
const openai_1 = __importDefault(require("openai"));
const index_js_1 = require("../config/index.js");
const deidentify_js_1 = require("./ai/deidentify.js");
const clinicalExtractor_js_1 = require("./ai/clinicalExtractor.js");
const drugKnowledge_js_1 = require("./ai/drugKnowledge.js");
/**
 * MedLedger AI Analysis Module (Project Guide, Chapters 6 & 7).
 *
 * Every feature works in two modes:
 *  - "local":  a built-in rules engine (reference ranges, drug knowledge base) — always available, no data leaves the server.
 *  - "openai": GPT-4o adds plain-language explanations. Only DE-IDENTIFIED text is ever sent,
 *              outputs are validated, and the local engine is used if the call fails or times out.
 */
exports.DISCLAIMER = 'This is informational only. Please consult a qualified healthcare professional.';
/** Guide §6.2 — fixed system prompt, never modifiable by users. */
const SUMMARY_SYSTEM_PROMPT = 'You are a medical report assistant helping patients understand their health records. ' +
    'You explain findings in simple non-technical language. You do NOT diagnose diseases or prescribe treatments. ' +
    'Given the report text, provide: (1) Plain-language summary in 3-5 sentences. ' +
    '(2) List of abnormal values with normal reference range. (3) Three questions the patient might ask their doctor. ' +
    'Always end with: This is informational only. Please consult a qualified healthcare professional. ' +
    'The text has been de-identified; placeholders such as [NAME] or [DATE] replace personal details — never try to guess them. ' +
    'Respond ONLY with JSON: {"summary": string, "keyFindings": string[], "abnormalValues": [{"test": string, "value": string, "referenceRange": string, "severity": "mild"|"moderate"|"requires attention", "explanation": string}], "questionsForDoctor": string[], "recommendations": string[]}';
const CHAT_SYSTEM_PROMPT = 'You are MedLedger\'s health-record assistant. Answer the user\'s questions using ONLY the de-identified health records provided below. ' +
    'Explain in simple language. Do not diagnose, do not prescribe, and do not tell the user to start, stop or change any medicine — suggest they discuss it with their doctor. ' +
    'If the records do not contain the answer, say so. For anything that sounds urgent (chest pain, breathing difficulty, fainting, severe bleeding), tell them to seek emergency care. ' +
    'Keep answers under 150 words and end with: This is informational only. Please consult a qualified healthcare professional.';
// ---------------------------------------------------------------------------
// Output safety checks (Guide §11.3)
// ---------------------------------------------------------------------------
const PRESCRIPTIVE = [
    [/\byou have been diagnosed with\b/gi, 'your report mentions'],
    [/\byou have (?=(?:a |an )?(?:[a-z-]+ )?(?:diabetes|an(?:a)?emia|hypertension|infection|disease|cancer|condition|disorder|deficiency|syndrome|failure|[a-z]+itis|[a-z]+osis)\b)/gi, 'your results may be consistent with '],
    [/\byou are suffering from\b/gi, 'your report suggests'],
    [/\b(?:you should |please )?(?:take|start|stop|increase|decrease|double) (?:this|the|your|a) (?:medication|medicine|dose|tablet)s?\b/gi, 'discuss your medicines with your doctor'],
    [/\bstop taking\b/gi, 'ask your doctor before changing'],
    [/\bstart taking\b/gi, 'ask your doctor about'],
    [/\bno need to see (?:a|your) doctor\b/gi, 'you can confirm this with your doctor']
];
const softenLanguage = (text) => PRESCRIPTIVE.reduce((t, [re, rep]) => t.replace(re, rep), text || '');
exports.softenLanguage = softenLanguage;
const withDisclaimer = (text) => {
    const t = (text || '').trim();
    return /informational only/i.test(t) ? t : `${t}${t ? '\n\n' : ''}${exports.DISCLAIMER}`;
};
const limitWords = (text, max) => {
    const words = text.split(/\s+/);
    return words.length <= max ? text : `${words.slice(0, max).join(' ')}…`;
};
// ---------------------------------------------------------------------------
class AIService {
    client = null;
    cache = new Map();
    cacheTtlMs = 24 * 60 * 60 * 1000;
    constructor() {
        if (index_js_1.config.openaiApiKey) {
            try {
                this.client = new openai_1.default({ apiKey: index_js_1.config.openaiApiKey, timeout: index_js_1.config.aiTimeoutMs, maxRetries: 1 });
            }
            catch (e) {
                console.warn('[AIService] OpenAI initialisation failed — using the built-in engine:', e.message);
            }
        }
    }
    /** Swap the external model client (used by tests; null = built-in engine only). */
    setClient(client) {
        this.client = client;
        this.cache.clear();
    }
    get engine() {
        return this.client ? 'openai' : 'local';
    }
    // ---------------- helpers ----------------
    cacheGet(key) {
        const hit = this.cache.get(key);
        if (hit && Date.now() - hit.at < this.cacheTtlMs)
            return hit.value;
        if (hit)
            this.cache.delete(key);
        return undefined;
    }
    cacheSet(key, value) {
        if (this.cache.size > 300)
            this.cache.delete(this.cache.keys().next().value);
        this.cache.set(key, { at: Date.now(), value });
    }
    key(feature, ...parts) {
        return `${feature}:${this.engine}:${crypto_1.default.createHash('sha256').update(JSON.stringify(parts)).digest('hex')}`;
    }
    /**
     * Fail-closed privacy gate: every message is re-scanned by an independent detector right before
     * it would leave the server. If anything that looks like an identifier is still present, the
     * external call is cancelled and the built-in engine answers instead. Only categories are logged.
     */
    privacy = { externalCalls: 0, blocked: 0, lastBlockedAt: null, lastBlockedCategories: [] };
    passesPrivacyGate(contents) {
        const findings = (0, deidentify_js_1.scanForPII)(contents.join('\n'));
        if (!findings.length)
            return true;
        this.privacy.blocked++;
        this.privacy.lastBlockedAt = new Date().toISOString();
        this.privacy.lastBlockedCategories = findings.map((f) => f.category);
        console.warn('[AIService] Privacy gate blocked an external AI call; possible identifiers:', findings.map((f) => `${f.category}×${f.count}`).join(', '));
        return false;
    }
    get privacyStats() {
        return { ...this.privacy, lastBlockedCategories: [...this.privacy.lastBlockedCategories] };
    }
    async askJson(system, user, model = index_js_1.config.openaiModel) {
        if (!this.client)
            return null;
        if (!this.passesPrivacyGate([system, user]))
            return null;
        this.privacy.externalCalls++;
        try {
            const resp = await this.client.chat.completions.create({
                model,
                temperature: 0.3, // Guide §6.8
                max_tokens: 1000,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user }
                ]
            }, { timeout: index_js_1.config.aiTimeoutMs });
            const content = resp.choices[0]?.message?.content;
            return content ? JSON.parse(content) : null;
        }
        catch (err) {
            console.warn('[AIService] External AI unavailable, using built-in engine:', err.message);
            return null;
        }
    }
    async askText(messages, model = index_js_1.config.openaiChatModel) {
        if (!this.client)
            return null;
        if (!this.passesPrivacyGate(messages.map((m) => m.content)))
            return null;
        this.privacy.externalCalls++;
        try {
            const resp = await this.client.chat.completions.create({ model, temperature: 0.3, max_tokens: 400, messages }, { timeout: index_js_1.config.aiTimeoutMs });
            return resp.choices[0]?.message?.content?.trim() || null;
        }
        catch (err) {
            console.warn('[AIService] External AI unavailable, using built-in engine:', err.message);
            return null;
        }
    }
    /** De-identify, then re-check model output so no identifier can leak back to the UI. */
    clean(text, knownNames) {
        return (0, exports.softenLanguage)((0, deidentify_js_1.deidentify)(text, knownNames).text);
    }
    toAbnormal(v) {
        return {
            test: v.label,
            value: v.display,
            referenceRange: v.referenceRange,
            status: v.status,
            severity: v.severity || 'mild',
            explanation: v.meaning || `${v.status === 'high' ? 'Above' : 'Below'} the usual reference range.`
        };
    }
    vitalsFrom(ex) {
        const get = (k) => ex.values.find((v) => v.key === k);
        const sys = get('systolic_bp');
        return {
            bloodPressure: sys?.display,
            heartRate: get('heart_rate')?.display,
            spO2: get('spo2')?.display,
            respiratoryRate: get('resp_rate')?.display,
            temperature: get('temperature')?.display
        };
    }
    uniqueAbnormal(ex) {
        // systolic/diastolic share one display — report blood pressure once
        const seen = new Set();
        return ex.abnormal.filter((v) => {
            const k = v.key === 'diastolic_bp' ? 'systolic_bp' : v.key;
            if (seen.has(k))
                return false;
            seen.add(k);
            return true;
        });
    }
    // ---------------- Feature: Summary (Guide §6.2) ----------------
    localSummary(ex, text) {
        const abnormal = this.uniqueAbnormal(ex);
        const measured = ex.values.filter((v) => v.key !== 'diastolic_bp').length;
        const sentences = [];
        if (measured === 0) {
            const firstLines = text
                .split(/\n|(?<=\.)\s+/)
                .map((l) => l.trim())
                .filter((l) => l.length > 15)
                .slice(0, 2);
            sentences.push('This document does not contain standard measurable lab values or vital signs that could be checked against reference ranges.');
            if (firstLines.length)
                sentences.push(`It states: "${limitWords(firstLines.join(' '), 45)}"`);
        }
        else {
            sentences.push(`This report contains ${measured} measured value${measured === 1 ? '' : 's'} that were compared with standard adult reference ranges.`);
            if (abnormal.length === 0) {
                sentences.push('All of them are within the normal range.');
            }
            else {
                const list = abnormal.slice(0, 4).map((v) => `${v.label} (${v.display}, ${v.status})`).join(', ');
                sentences.push(`${abnormal.length} ${abnormal.length === 1 ? 'value is' : 'values are'} outside the usual range: ${list}${abnormal.length > 4 ? ', and others' : ''}.`);
                const normalCount = measured - abnormal.length;
                if (normalCount > 0)
                    sentences.push(`The other ${normalCount} ${normalCount === 1 ? 'value is' : 'values are'} normal.`);
            }
        }
        if (ex.impressions.length)
            sentences.push(`The report's conclusion notes: "${limitWords(ex.impressions[0], 30)}"`);
        if (ex.medications.length)
            sentences.push(`Medicines mentioned: ${ex.medications.join(', ')}.`);
        const keyFindings = [
            ...abnormal.map((v) => `${v.label}: ${v.display} — ${v.status === 'high' ? 'above' : 'below'} the reference range (${v.referenceRange}).`),
            ...ex.impressions.slice(0, 3).map((i) => `Report conclusion: ${i}`)
        ];
        if (keyFindings.length === 0 && measured > 0)
            keyFindings.push('All measured values are within the reference ranges.');
        const questions = abnormal
            .slice(0, 3)
            .map((v) => `My ${v.label.toLowerCase()} was ${v.display}. What might be causing this, and does it need follow-up or a repeat test?`);
        const generic = [
            'Do any of these results change my current treatment plan?',
            'When should I repeat these tests?',
            'Is there anything in my lifestyle or diet I should adjust based on this report?'
        ];
        while (questions.length < 3)
            questions.push(generic[questions.length]);
        const recommendations = [];
        if (abnormal.some((v) => v.severity === 'requires attention')) {
            recommendations.push('Some values are in a range that usually needs prompt medical attention — please contact your doctor soon, or seek urgent care if you feel unwell.');
        }
        if (abnormal.length)
            recommendations.push('Discuss the flagged values with your doctor, who can interpret them together with your symptoms and history.');
        recommendations.push('Keep this report so future results can be compared for trends.');
        return { summary: sentences.join(' '), keyFindings, questionsForDoctor: questions, recommendations };
    }
    async summarizeReport(rawText, knownNames = [], sex) {
        const deid = (0, deidentify_js_1.deidentify)(rawText || '', knownNames);
        const ex = (0, clinicalExtractor_js_1.extractClinicalData)(deid.text, sex);
        const cacheKey = this.key('summary', deid.text, sex);
        const cached = this.cacheGet(cacheKey);
        if (cached)
            return cached;
        const local = this.localSummary(ex, deid.text);
        const localAbnormal = this.uniqueAbnormal(ex).map((v) => this.toAbnormal(v));
        let result = {
            ...local,
            vitalSigns: this.vitalsFrom(ex),
            labValues: ex.values,
            abnormalValues: localAbnormal,
            keywordFlags: ex.keywordFlags,
            medications: ex.medications,
            engine: 'local',
            deidentification: { redactions: deid.redactions, categories: deid.categories, categoryCounts: deid.categoryCounts },
            safetyDisclaimer: exports.DISCLAIMER,
            generatedAt: new Date().toISOString()
        };
        if (this.client) {
            // Layer 3: the model explains; the numeric comparator's findings are passed in so it cannot miss them.
            const ai = await this.askJson(SUMMARY_SYSTEM_PROMPT, `REPORT (de-identified):\n${deid.text}\n\nVALUES ALREADY FLAGGED BY THE REFERENCE-RANGE CHECK:\n${localAbnormal.map((a) => `- ${a.test}: ${a.value} (normal ${a.referenceRange})`).join('\n') || '- none'}`);
            if (ai && typeof ai.summary === 'string' && ai.summary.trim()) {
                const explained = new Map((ai.abnormalValues || []).map((a) => [String(a.test || '').toLowerCase(), a]));
                result = {
                    ...result,
                    summary: this.clean(limitWords(ai.summary, 300), knownNames).replace(/\s*This is informational only\.[^]*$/i, ''),
                    keyFindings: (ai.keyFindings || result.keyFindings).slice(0, 8).map((f) => this.clean(String(f), knownNames)),
                    // never drop a value the numeric check found; the model only adds explanation
                    abnormalValues: localAbnormal.map((a) => {
                        const e = explained.get(a.test.toLowerCase());
                        return e?.explanation ? { ...a, explanation: this.clean(String(e.explanation), knownNames) } : a;
                    }),
                    questionsForDoctor: (ai.questionsForDoctor || result.questionsForDoctor).slice(0, 3).map((q) => this.clean(String(q), knownNames)),
                    recommendations: (ai.recommendations || result.recommendations).slice(0, 5).map((r) => this.clean(String(r), knownNames)),
                    engine: 'openai'
                };
            }
        }
        this.cacheSet(cacheKey, result);
        return result;
    }
    // ---------------- Feature: Abnormal value detection (Guide §6.3) ----------------
    async analyzeAbnormal(rawText, knownNames = [], sex) {
        const summary = await this.summarizeReport(rawText, knownNames, sex);
        return {
            layers: {
                keywordScanner: summary.keywordFlags,
                numericComparator: summary.labValues,
                explanation: summary.abnormalValues
            },
            abnormalValues: summary.abnormalValues,
            triageLevel: this.triageLevel(summary.abnormalValues),
            engine: summary.engine,
            safetyDisclaimer: exports.DISCLAIMER
        };
    }
    triageLevel(abnormal) {
        if (abnormal.some((a) => a.severity === 'requires attention'))
            return 'Urgent review';
        if (abnormal.some((a) => a.severity === 'moderate'))
            return 'Priority review';
        if (abnormal.length)
            return 'Routine follow-up';
        return 'Normal';
    }
    // ---------------- Feature: Drug interactions & information (Guide §6.5) ----------------
    async checkDrugInteractions(drugs, allergies = []) {
        const cleanDrugs = drugs.map((d) => String(d).slice(0, 80)).filter((d) => d.trim()).slice(0, 20);
        const cleanAllergies = allergies.map((a) => String(a).slice(0, 60)).filter((a) => a.trim()).slice(0, 10);
        const cacheKey = this.key('drugs', cleanDrugs, cleanAllergies);
        const cached = this.cacheGet(cacheKey);
        if (cached)
            return cached;
        const kb = (0, drugKnowledge_js_1.checkInteractions)(cleanDrugs, cleanAllergies);
        const alerts = kb.alerts.map((a) => ({ ...a, source: 'knowledge-base' }));
        let engine = 'local';
        // Unknown medicines: ask the model (names only — no patient data involved)
        if (this.client && kb.unrecognised.length && cleanDrugs.length > 1) {
            const ai = await this.askJson('You are a clinical pharmacology reference. List only well-established, clinically significant interactions between the medicines given. ' +
                'Do not recommend dose changes. Respond with JSON: {"alerts":[{"severity":"high"|"moderate"|"low","drugs":[string,string],"description":string,"actionableAdvice":string}]}. ' +
                'Return an empty list if you are not confident.', `Medicines: ${cleanDrugs.join(', ')}\nAllergies: ${cleanAllergies.join(', ') || 'none reported'}`);
            if (ai?.alerts?.length) {
                engine = 'openai';
                for (const a of ai.alerts.slice(0, 6)) {
                    const severity = (['high', 'moderate', 'low'].includes(String(a.severity)) ? a.severity : 'moderate');
                    const pair = (a.drugs || []).map(String);
                    if (alerts.some((x) => x.drugs.join('+').toLowerCase() === pair.join('+').toLowerCase()))
                        continue;
                    alerts.push({
                        severity,
                        drugs: pair,
                        description: (0, exports.softenLanguage)(String(a.description || '')),
                        actionableAdvice: (0, exports.softenLanguage)(String(a.actionableAdvice || 'Check with your pharmacist or doctor.')),
                        kind: 'interaction',
                        source: 'openai'
                    });
                }
            }
        }
        const result = {
            hasSevereConflict: alerts.some((a) => a.severity === 'high'),
            alerts,
            recognised: kb.recognised.map((d) => d.name),
            unrecognised: kb.unrecognised,
            engine,
            safetyDisclaimer: exports.DISCLAIMER
        };
        this.cacheSet(cacheKey, result);
        return result;
    }
    async drugInfo(name) {
        const known = (0, drugKnowledge_js_1.findDrug)(name);
        if (known) {
            return {
                name: known.name,
                found: true,
                purpose: known.purpose,
                commonSideEffects: known.commonSideEffects,
                precautions: known.precautions,
                engine: 'local',
                safetyDisclaimer: exports.DISCLAIMER
            };
        }
        // Guide §6.4-6.8 prompt for medicines outside the built-in list
        const ai = await this.askJson('Explain the named medicine to a non-medical patient. Include purpose, common side effects and key precautions. ' +
            'Under 100 words in total. Do not recommend dosage changes. If it is not a real medicine, return empty fields. ' +
            'Respond with JSON: {"purpose": string, "commonSideEffects": string[], "precautions": string[]}', `Medicine: ${String(name).slice(0, 80)}`, index_js_1.config.openaiChatModel);
        if (ai?.purpose) {
            return {
                name: String(name).trim(),
                found: true,
                purpose: (0, exports.softenLanguage)(ai.purpose),
                commonSideEffects: (ai.commonSideEffects || []).slice(0, 6).map(String),
                precautions: (ai.precautions || []).slice(0, 5).map((p) => (0, exports.softenLanguage)(String(p))),
                engine: 'openai',
                safetyDisclaimer: exports.DISCLAIMER
            };
        }
        return {
            name: String(name).trim(),
            found: false,
            purpose: 'This medicine is not in the built-in reference list. Please ask your pharmacist or doctor about it.',
            commonSideEffects: [],
            precautions: [],
            engine: this.engine,
            safetyDisclaimer: exports.DISCLAIMER
        };
    }
    // ---------------- Feature: Trend analysis (Guide §6.4) ----------------
    async analyzeTrends(documents, knownNames = [], sex, readings = [], options = {}) {
        const byKey = new Map();
        const sorted = [...documents].filter((d) => d.text).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        for (const doc of sorted) {
            const ex = (0, clinicalExtractor_js_1.extractClinicalData)((0, deidentify_js_1.deidentify)(doc.text, knownNames).text, sex);
            for (const v of ex.values) {
                const s = byKey.get(v.key) ||
                    { key: v.key, label: v.label, unit: v.unit, referenceRange: v.referenceRange, points: [], direction: 'single reading', changePercent: null, latestStatus: 'normal', note: '' };
                // one value per series per record (a report may mention the same test twice)
                if (!s.points.some((p) => p.reportId && p.reportId === doc.reportId)) {
                    s.points.push({ date: doc.date, value: v.value, status: v.status, source: doc.source, origin: 'report', reportId: doc.reportId });
                }
                byKey.set(v.key, s);
            }
        }
        // home and clinic readings
        for (const r of readings) {
            const v = (0, clinicalExtractor_js_1.evaluateMeasurement)(r.key, r.value, sex || 'unknown');
            if (!v)
                continue;
            const s = byKey.get(v.key) ||
                { key: v.key, label: v.label, unit: v.unit, referenceRange: v.referenceRange, points: [], direction: 'single reading', changePercent: null, latestStatus: 'normal', note: '' };
            s.points.push({ date: r.date, value: v.value, status: v.status, source: r.source, origin: r.origin });
            byKey.set(v.key, s);
        }
        for (const s of byKey.values()) {
            s.points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const range = (0, clinicalExtractor_js_1.numericRange)(s.key, sex || 'unknown');
            if (range.low !== undefined)
                s.rangeLow = range.low;
            if (range.high !== undefined)
                s.rangeHigh = range.high;
        }
        const series = [...byKey.values()].map((s) => {
            const first = s.points[0];
            const last = s.points[s.points.length - 1];
            s.latestStatus = last.status;
            if (s.points.length >= 2 && first.value !== 0) {
                const change = ((last.value - first.value) / Math.abs(first.value)) * 100;
                s.changePercent = Math.round(change * 10) / 10;
                s.direction = Math.abs(change) < 5 ? 'stable' : change > 0 ? 'rising' : 'falling';
            }
            const where = last.status === 'normal' ? 'within the normal range' : `${last.status === 'high' ? 'above' : 'below'} the normal range`;
            s.note =
                s.points.length < 2
                    ? `One reading so far (${where}).`
                    : `${s.direction === 'stable' ? 'Stable' : s.direction === 'rising' ? 'Rising' : 'Falling'} across ${s.points.length} readings (${s.changePercent > 0 ? '+' : ''}${s.changePercent}%); latest is ${where}.`;
            return s;
        });
        const moving = series.filter((s) => s.points.length >= 2);
        const concerning = series.filter((s) => s.latestStatus !== 'normal');
        let narrative = series.length === 0
            ? 'No measurable values were found yet, so trends cannot be shown. Trends appear once reports with lab values are uploaded or readings are added.'
            : `${series.length} measurement${series.length === 1 ? '' : 's'} found across ${sorted.length} record${sorted.length === 1 ? '' : 's'}${readings.length ? ` and ${new Set(readings.map((r) => `${r.date}|${r.origin}`)).size} reading${readings.length === 1 ? '' : 's'}` : ''}. ` +
                (moving.length
                    ? `${moving.length} ${moving.length === 1 ? 'has' : 'have'} more than one reading to compare. `
                    : 'Each measurement has only one reading so far, so direction cannot be judged yet. ') +
                (concerning.length
                    ? `Latest readings outside the normal range: ${concerning.map((s) => s.label).join(', ')}.`
                    : 'All latest readings are within normal ranges.');
        let engine = 'local';
        if (this.client && moving.length && options.narrative !== false) {
            const text = await this.askText([
                { role: 'system', content: 'Describe these health measurement trends for a patient in plain language, under 120 words. Do not diagnose or prescribe. End with: This is informational only. Please consult a qualified healthcare professional.' },
                // Dates are identifiers under Safe Harbor: send days relative to the first reading instead
                {
                    role: 'user',
                    content: moving
                        .map((s) => {
                        const t0 = new Date(s.points[0]?.date || Date.now()).getTime();
                        const pts = s.points.map((p) => `day ${Math.max(0, Math.round((new Date(p.date).getTime() - t0) / 86_400_000))}=${p.value}`);
                        return `${s.label} (${s.unit}, normal ${s.referenceRange}): ${pts.join(', ')}`;
                    })
                        .join('\n')
                }
            ]);
            if (text) {
                narrative = this.clean(text, knownNames).replace(/\s*This is informational only\.[^]*$/i, '');
                engine = 'openai';
            }
        }
        return { series, narrative, engine, safetyDisclaimer: exports.DISCLAIMER };
    }
    // ---------------- Feature: Health risk flags ----------------
    healthRisks(rawText, knownNames = [], sex) {
        const ex = (0, clinicalExtractor_js_1.extractClinicalData)((0, deidentify_js_1.deidentify)(rawText, knownNames).text, sex);
        const v = (k) => ex.values.find((x) => x.key === k)?.value;
        const risks = [];
        const sys = v('systolic_bp');
        const dia = v('diastolic_bp');
        if (sys !== undefined && dia !== undefined) {
            if (sys >= 180 || dia >= 120)
                risks.push({ area: 'Blood pressure', level: 'seek prompt care', reason: `Reading of ${sys}/${dia} mmHg is in a very high range.` });
            else if (sys >= 140 || dia >= 90)
                risks.push({ area: 'Blood pressure', level: 'discuss with doctor', reason: `Reading of ${sys}/${dia} mmHg is in the high blood-pressure range if repeated.` });
            else if (sys >= 130 || dia >= 80)
                risks.push({ area: 'Blood pressure', level: 'watch', reason: `Reading of ${sys}/${dia} mmHg is mildly raised.` });
        }
        const fbs = v('fasting_glucose');
        const a1c = v('hba1c');
        if ((fbs !== undefined && fbs >= 126) || (a1c !== undefined && a1c >= 6.5)) {
            risks.push({ area: 'Blood sugar', level: 'discuss with doctor', reason: 'Values are in the range used to diagnose diabetes (confirmation by repeat testing is usually needed).' });
        }
        else if ((fbs !== undefined && fbs >= 100) || (a1c !== undefined && a1c >= 5.7)) {
            risks.push({ area: 'Blood sugar', level: 'watch', reason: 'Values are in the prediabetes range.' });
        }
        const ldl = v('ldl');
        const tc = v('total_cholesterol');
        if ((ldl !== undefined && ldl >= 160) || (tc !== undefined && tc >= 240)) {
            risks.push({ area: 'Cholesterol', level: 'discuss with doctor', reason: 'Cholesterol is in the high range, which raises long-term heart risk.' });
        }
        else if ((ldl !== undefined && ldl >= 130) || (tc !== undefined && tc >= 200)) {
            risks.push({ area: 'Cholesterol', level: 'watch', reason: 'Cholesterol is borderline high.' });
        }
        const hb = ex.values.find((x) => x.key === 'hemoglobin');
        if (hb && hb.status === 'low')
            risks.push({ area: 'Anaemia', level: hb.severity === 'requires attention' ? 'seek prompt care' : 'discuss with doctor', reason: `Hemoglobin ${hb.display} is below the normal range.` });
        const spo2 = v('spo2');
        if (spo2 !== undefined && spo2 < 92)
            risks.push({ area: 'Oxygen level', level: 'seek prompt care', reason: `SpO2 of ${spo2}% is low.` });
        const cr = ex.values.find((x) => x.key === 'creatinine');
        if (cr && cr.status === 'high')
            risks.push({ area: 'Kidney function', level: 'discuss with doctor', reason: `Creatinine ${cr.display} is above the normal range.` });
        return { risks, engine: 'local', safetyDisclaimer: exports.DISCLAIMER };
    }
    // ---------------- Feature: Medical chat assistant (Guide §6.6) ----------------
    localAnswer(question, ex, contextText) {
        const q = question.toLowerCase();
        if (/chest pain|can'?t breathe|difficulty breathing|short(ness)? of breath|faint|unconscious|severe bleeding|suicid/.test(q)) {
            return 'That could be urgent. If you have chest pain, trouble breathing, fainting or heavy bleeding, please call emergency services or go to the nearest emergency department now.';
        }
        // A specific test the user asked about?
        const askedKey = (0, clinicalExtractor_js_1.findTestInQuestion)(question);
        const test = askedKey ? ex.values.find((v) => v.key === askedKey) : undefined;
        if (askedKey && !test) {
            return `I could not find a ${askedKey.replace(/_/g, ' ').replace('systolic bp', 'blood pressure')} result in your records.`;
        }
        if (test) {
            const statusText = test.status === 'normal'
                ? 'which is within the normal range'
                : `which is ${test.status === 'high' ? 'above' : 'below'} the normal range (${test.severity})`;
            return `Your ${test.label.toLowerCase()} was ${test.display}, ${statusText}. The usual adult range is ${test.referenceRange}.${test.meaning && test.status !== 'normal' ? ` ${test.meaning}` : ''}`;
        }
        // Medicine questions
        const drugMatch = question.split(/[\s,?.]+/).map((w) => (0, drugKnowledge_js_1.findDrug)(w)).find(Boolean);
        if (drugMatch) {
            return `${drugMatch.name}: ${drugMatch.purpose} Common side effects: ${drugMatch.commonSideEffects.join(', ').toLowerCase() || 'usually few'}. ${drugMatch.precautions.join(' ')}`;
        }
        if (/medic|medicine|tablet|prescription|drug|pill/.test(q)) {
            return ex.medications.length
                ? `Your records mention: ${ex.medications.join(', ')}. Ask me about any one of them by name for a plain-language explanation.`
                : 'I could not find any medicines named in your records.';
        }
        if (/abnormal|result|report|summary|how am i|am i ok|normal|blood test|lab/.test(q)) {
            const abnormal = this.uniqueAbnormal(ex);
            if (!ex.values.length)
                return 'Your records do not contain measurable lab values yet. Once a lab report with values is uploaded I can explain it.';
            if (!abnormal.length)
                return `All ${ex.values.length} measured values in your records are within the normal ranges.`;
            return `${abnormal.length} value${abnormal.length === 1 ? ' is' : 's are'} outside the usual range: ${abnormal
                .map((v) => `${v.label} ${v.display} (${v.status})`)
                .join('; ')}. These are worth discussing with your doctor.`;
        }
        if (/question|ask (my|the) doctor|doctor visit|appointment/.test(q)) {
            return this.localSummary(ex, contextText).questionsForDoctor.map((x, i) => `${i + 1}) ${x}`).join(' ');
        }
        return ex.values.length
            ? `I can explain the values in your records (for example ${ex.values.slice(0, 3).map((v) => v.label.toLowerCase()).join(', ')}), your medicines, or suggest questions for your doctor. What would you like to know?`
            : 'I can help explain your uploaded reports and medicines. Your current records do not contain lab values yet — try asking about a medicine by name, or upload a lab report.';
    }
    // ---------- trend-aware answers ----------
    static fmtNum(n) {
        return n >= 1000 ? n.toLocaleString('en-US') : String(Math.round(n * 100) / 100);
    }
    static fmtDate(iso) {
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? 'an unknown date' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    static originText(p) {
        return p.origin === 'home' ? 'your home reading' : p.origin === 'clinic' ? 'a clinic reading' : p.source ? `report ${p.source}` : 'a report';
    }
    static toSource(s, p) {
        return {
            label: p.origin === 'report' ? p.source || s.label : `${p.origin === 'home' ? 'Home' : 'Clinic'} reading · ${s.label.replace(/ \((?:systolic|diastolic)\)/, '')}`,
            date: p.date,
            origin: p.origin || 'report',
            ...(p.reportId ? { reportId: p.reportId } : {})
        };
    }
    /** Answers "what was my …" / "is my … improving" from the dated series (reports + home readings). */
    seriesAnswer(question, series) {
        const q = question.toLowerCase();
        const isTrend = /trend|improv|over time|getting (?:better|worse)|chang|compar|histor|before|previous|progress|going (?:up|down)|increas|decreas|better|worse/.test(q);
        let key = (0, clinicalExtractor_js_1.findTestInQuestion)(question);
        const find = (k) => series.find((x) => x.key === k && x.points.length);
        // "sugar" alone: use whichever sugar series the patient actually has
        if (key === 'random_glucose' && !find('random_glucose') && find('fasting_glucose'))
            key = 'fasting_glucose';
        if (!key) {
            if (!isTrend || !series.length)
                return null;
            const moving = series.filter((x) => x.points.length >= 2);
            if (!moving.length) {
                return { reply: 'Each measurement has only one value so far, so there is no trend yet. Add readings over time (for example blood pressure or sugar at home) and I can tell you how they change.', sources: [] };
            }
            const lines = moving.slice(0, 6).map((x) => {
                const last = x.points[x.points.length - 1];
                return `${x.label.replace(' (systolic)', '')}: ${x.direction === 'stable' ? 'stable' : x.direction} (${x.changePercent > 0 ? '+' : ''}${x.changePercent}%), latest ${AIService.fmtNum(last.value)} ${x.unit}${last.status !== 'normal' ? ` (${last.status})` : ''}`;
            });
            return {
                reply: `Here is how your measurements have changed: ${lines.join('; ')}.`,
                sources: moving.slice(0, 6).map((x) => AIService.toSource(x, x.points[x.points.length - 1]))
            };
        }
        const s = find(key);
        if (!s)
            return null;
        const isBp = key === 'systolic_bp';
        const dia = isBp ? find('diastolic_bp') : undefined;
        const val = (p) => {
            if (isBp && dia) {
                const d = dia.points.find((x) => x.date === p.date && x.origin === p.origin);
                if (d)
                    return `${AIService.fmtNum(p.value)}/${AIService.fmtNum(d.value)} mmHg`;
            }
            return `${AIService.fmtNum(p.value)} ${s.unit}`;
        };
        const statusOf = (p) => {
            if (isBp && dia) {
                const d = dia.points.find((x) => x.date === p.date && x.origin === p.origin);
                if (p.status === 'high' || d?.status === 'high')
                    return 'above the normal range';
                if (p.status === 'low' || d?.status === 'low')
                    return 'below the normal range';
                return 'within the normal range';
            }
            return p.status === 'normal' ? 'within the normal range' : `${p.status === 'high' ? 'above' : 'below'} the normal range`;
        };
        const name = isBp ? 'blood pressure' : s.label.toLowerCase();
        const range = isBp ? '90–120 / 60–80 mmHg' : s.referenceRange;
        const pts = s.points;
        const last = pts[pts.length - 1];
        const prev = pts.length >= 2 ? pts[pts.length - 2] : undefined;
        const first = pts[0];
        let reply = `Your latest ${name} was ${val(last)} on ${AIService.fmtDate(last.date)} (${AIService.originText(last)}), which is ${statusOf(last)}`;
        reply += s.rangeLow !== undefined || s.rangeHigh !== undefined || isBp ? ` (usual adult range ${range}).` : '.';
        const sources = [AIService.toSource(s, last)];
        if (prev) {
            reply += ` Before that it was ${val(prev)} on ${AIService.fmtDate(prev.date)}.`;
            sources.push(AIService.toSource(s, prev));
            if (pts.length >= 2 && (isTrend || pts.length >= 3)) {
                const word = s.direction === 'stable' ? 'stayed about the same' : s.direction === 'rising' ? 'gone up' : 'come down';
                reply += ` Across ${pts.length} readings since ${AIService.fmtDate(first.date)} it has ${word} (${s.changePercent > 0 ? '+' : ''}${s.changePercent}%).`;
            }
        }
        else if (isTrend) {
            reply += ' There is only one value so far, so a trend cannot be judged yet — adding readings over time will show one.';
        }
        const meaning = last.status !== 'normal' ? (0, clinicalExtractor_js_1.evaluateMeasurement)(s.key, last.value)?.meaning : undefined;
        if (meaning)
            reply += ` ${meaning}`;
        return { reply, sources };
    }
    /** Which dated values an answer quotes — shown under the reply as its sources. */
    sourcesQuoted(reply, series) {
        const out = [];
        const seen = new Set();
        for (const s of series) {
            for (const p of s.points) {
                const v = AIService.fmtNum(p.value);
                const hit = new RegExp(`(?<![\\d.])${v.replace('.', '\\.')}(?![\\d.])\\s*(?:/\\s*\\d+\\s*)?${s.unit.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`, 'i').test(reply);
                if (!hit)
                    continue;
                const src = AIService.toSource(s, p);
                const k = `${src.label}|${src.date}`;
                if (!seen.has(k)) {
                    seen.add(k);
                    out.push(src);
                }
            }
        }
        return out.slice(0, 6);
    }
    async chat(messages, contextText, knownNames = [], sex, series = []) {
        const history = messages.filter((m) => m && typeof m.content === 'string' && m.content.trim()).slice(-6); // Guide: last 6 messages
        const last = [...history].reverse().find((m) => m.role === 'user');
        if (!last)
            return { reply: 'Please type a question.', engine: this.engine, safetyDisclaimer: exports.DISCLAIMER, sources: [] };
        const context = (0, deidentify_js_1.deidentify)(contextText || '', knownNames).text.slice(0, 6000);
        const ex = (0, clinicalExtractor_js_1.extractClinicalData)(context, sex);
        if (this.client) {
            // readings as relative days — exact dates are identifiers and are never sent out
            const now = Date.now();
            const readingsText = series
                .map((s) => `${s.label} (${s.unit}): ${s.points.map((p) => `${AIService.fmtNum(p.value)} [${p.origin === 'report' ? 'report' : `${p.origin} reading`}, ${Math.max(0, Math.round((now - new Date(p.date).getTime()) / 86_400_000))} days ago]`).join(', ')}`)
                .join('\n')
                .slice(0, 3000);
            const reply = await this.askText([
                {
                    role: 'system',
                    content: `${CHAT_SYSTEM_PROMPT}\n\nHEALTH RECORDS (de-identified):\n${context || '(no records)'}${readingsText ? `\n\nMEASUREMENTS OVER TIME (oldest first):\n${readingsText}` : ''}`
                },
                ...history.map((m) => ({ role: m.role, content: (0, deidentify_js_1.deidentify)(m.content.slice(0, 1000), knownNames).text }))
            ]);
            if (reply) {
                const clean = this.clean(reply, knownNames);
                return { reply: withDisclaimer(clean), engine: 'openai', safetyDisclaimer: exports.DISCLAIMER, sources: this.sourcesQuoted(clean, series) };
            }
        }
        const q = last.content.toLowerCase();
        const urgent = /chest pain|can'?t breathe|difficulty breathing|short(ness)? of breath|faint|unconscious|severe bleeding|suicid/.test(q);
        const fromSeries = urgent ? null : this.seriesAnswer(last.content, series);
        if (fromSeries) {
            return { reply: withDisclaimer(fromSeries.reply), engine: 'local', safetyDisclaimer: exports.DISCLAIMER, sources: fromSeries.sources };
        }
        const reply = this.localAnswer(last.content, ex, context);
        return { reply: withDisclaimer(reply), engine: 'local', safetyDisclaimer: exports.DISCLAIMER, sources: this.sourcesQuoted(reply, series) };
    }
    // ---------------- Clinician tools ----------------
    async synthesizeChart(documents, knownNames = [], sex, readings = []) {
        const trends = await this.analyzeTrends(documents, knownNames, sex, readings);
        const combined = documents.map((d) => d.text).join('\n');
        const ex = (0, clinicalExtractor_js_1.extractClinicalData)((0, deidentify_js_1.deidentify)(combined, knownNames).text, sex);
        const abnormal = this.uniqueAbnormal(ex);
        const risks = this.healthRisks(combined, knownNames, sex).risks;
        return {
            title: 'Longitudinal Patient Record Synthesis',
            recordsReviewed: documents.length,
            patientStatus: abnormal.some((a) => a.severity === 'requires attention')
                ? 'Needs prompt review'
                : abnormal.length
                    ? 'Abnormal values present'
                    : ex.values.length
                        ? 'All measured values in range'
                        : 'No measurable values on file',
            vitalTrends: trends.series.map((s) => ({
                parameter: s.label,
                trend: s.direction,
                latest: `${s.points[s.points.length - 1].value} ${s.unit}`,
                range: s.referenceRange,
                status: s.latestStatus
            })),
            series: trends.series,
            activeMedications: ex.medications,
            riskFlags: risks,
            clinicalSummary: trends.narrative,
            engine: trends.engine,
            safetyDisclaimer: 'AI-generated synthesis for clinician review. It does not replace clinical judgement.'
        };
    }
    async labTriage(rawText, knownNames = [], sex) {
        const result = await this.analyzeAbnormal(rawText, knownNames, sex);
        const followUp = {
            'Urgent review': 'Contact the patient promptly; consider same-day clinical review.',
            'Priority review': 'Review within a few days and consider repeat testing.',
            'Routine follow-up': 'Discuss at the next routine visit; repeat testing as clinically indicated.',
            Normal: 'No abnormal values detected; routine follow-up.'
        };
        return {
            triageLevel: result.triageLevel,
            abnormalValues: result.abnormalValues,
            keywordFlags: result.layers.keywordScanner,
            recommendedFollowup: followUp[result.triageLevel],
            engine: result.engine,
            safetyDisclaimer: 'Automated triage aid only. Requires review by a qualified clinician or laboratory professional.'
        };
    }
    async soapNote(rawText, knownNames = [], sex) {
        const deid = (0, deidentify_js_1.deidentify)(rawText || '', knownNames).text;
        const ex = (0, clinicalExtractor_js_1.extractClinicalData)(deid, sex);
        const abnormal = this.uniqueAbnormal(ex);
        const subjectiveLines = deid
            .split(/\n|(?<=\.)\s+/)
            .filter((l) => /\b(c\/o|complain|complaint|symptom|reports?|history|presents? with|feels?)\b/i.test(l))
            .slice(0, 3);
        const vitals = this.vitalsFrom(ex);
        const objective = [
            Object.entries(vitals)
                .filter(([, val]) => val)
                .map(([k, val]) => `${k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}: ${val}`)
                .join(', '),
            ex.values
                .filter((v) => !['systolic_bp', 'diastolic_bp', 'heart_rate', 'spo2', 'resp_rate', 'temperature'].includes(v.key))
                .map((v) => `${v.label} ${v.display}${v.status !== 'normal' ? ` (${v.status.toUpperCase()})` : ''}`)
                .join('; ')
        ]
            .filter(Boolean)
            .join('. ');
        let note = {
            subjective: subjectiveLines.join(' ') || 'No patient-reported symptoms recorded in the source documents.',
            objective: objective || 'No measurable vitals or lab values in the source documents.',
            assessment: [
                ex.impressions.length ? `Documented impression: ${ex.impressions.join('; ')}.` : '',
                abnormal.length ? `Values outside reference range: ${abnormal.map((a) => `${a.label} ${a.display}`).join(', ')}.` : 'No out-of-range values detected.'
            ]
                .filter(Boolean)
                .join(' '),
            plan: [
                abnormal.length ? `Consider repeat/confirmatory testing for: ${abnormal.map((a) => a.label).join(', ')}.` : '',
                ex.medications.length ? `Current medicines noted: ${ex.medications.join(', ')} — reconcile and check interactions.` : '',
                '[Physician to complete management plan.]'
            ]
                .filter(Boolean)
                .join(' '),
            engine: 'local',
            safetyDisclaimer: 'Draft generated by the AI assistant from de-identified records. Requires physician review and sign-off.'
        };
        if (this.client && deid.trim()) {
            const ai = await this.askJson('Draft a SOAP note for a physician from the de-identified clinical text. Use only information present in the text; do not invent findings. ' +
                'The assessment must list findings to consider, not a definitive diagnosis. The plan must end with "[Physician to complete management plan.]". ' +
                'Respond with JSON: {"subjective": string, "objective": string, "assessment": string, "plan": string}', deid.slice(0, 6000));
            if (ai?.assessment) {
                note = {
                    ...note,
                    subjective: this.clean(String(ai.subjective || note.subjective), knownNames),
                    objective: this.clean(String(ai.objective || note.objective), knownNames),
                    assessment: this.clean(String(ai.assessment), knownNames),
                    plan: this.clean(String(ai.plan || note.plan), knownNames),
                    engine: 'openai'
                };
            }
        }
        return note;
    }
}
exports.AIService = AIService;
exports.aiService = new AIService();
