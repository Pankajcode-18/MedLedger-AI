"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiController = exports.AIController = void 0;
const zod_1 = require("zod");
const aiService_js_1 = require("../services/aiService.js");
const deidentify_js_1 = require("../services/ai/deidentify.js");
const stateStore_js_1 = require("../models/stateStore.js");
const accessPolicy_js_1 = require("../services/accessPolicy.js");
const recordText_js_1 = require("../services/recordText.js");
const vitalsService_js_1 = require("../services/vitalsService.js");
const chatStore_js_1 = require("../services/chatStore.js");
const auditService_js_1 = require("../services/auditService.js");
const MAX_TEXT = 20_000;
const textSchema = zod_1.z.string().max(MAX_TEXT, 'Report text is too long (max 20,000 characters).').optional();
const summarizeSchema = zod_1.z.object({ reportText: textSchema, patientId: zod_1.z.string().max(64).optional(), reportId: zod_1.z.string().max(64).optional() });
const drugSchema = zod_1.z.object({
    medications: zod_1.z.array(zod_1.z.string().max(80)).min(1, 'Enter at least one medicine.').max(20),
    allergies: zod_1.z.array(zod_1.z.string().max(60)).max(10).optional()
});
const drugInfoSchema = zod_1.z.object({ name: zod_1.z.string().min(2, 'Enter a medicine name.').max(80) });
const chatSchema = zod_1.z
    .object({
    /** one new question — the saved conversation supplies the history */
    message: zod_1.z.string().trim().min(1, 'Please type a question.').max(2000).optional(),
    /** older clients send the recent messages themselves */
    messages: zod_1.z
        .array(zod_1.z.object({ role: zod_1.z.enum(['user', 'assistant']), content: zod_1.z.string().min(1).max(2000) }))
        .min(1)
        .max(20)
        .optional(),
    patientId: zod_1.z.string().max(64).optional()
})
    .refine((b) => b.message || b.messages, { message: 'Please type a question.' });
const historyQuery = zod_1.z.object({ patientId: zod_1.z.string().max(64).optional() });
const patientTextSchema = zod_1.z.object({
    patientId: zod_1.z.string().max(64).optional(),
    reportText: textSchema,
    history: textSchema,
    labResults: zod_1.z.union([zod_1.z.string().max(MAX_TEXT), zod_1.z.record(zod_1.z.unknown())]).optional()
});
class HttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
/** Every person name the system knows about — removed from text before any AI processing. */
const knownNames = (req) => {
    const s = stateStore_js_1.stateStore.getState();
    return [
        ...s.patients.map((p) => p.name),
        ...s.doctors.map((d) => d.name),
        ...(s.users || []).map((u) => u.name),
        req.user?.name || ''
    ].filter((n) => n && n.length >= 3);
};
/** Loads a patient's record texts, enforcing consent. */
const patientDocuments = async (req, patientId, reportId) => {
    const user = req.user;
    const pid = String(user?.role === 'patient' ? user.userId : patientId || '');
    if (!pid)
        return [];
    if (!(await (0, accessPolicy_js_1.canReadPatientRecords)(user, pid))) {
        throw new HttpError(403, 'You do not have the patient\'s permission to analyse their records. Request access first.');
    }
    return stateStore_js_1.stateStore
        .getState()
        .reports.filter((r) => String(r.patientId) === pid && (!reportId || r.reportId === reportId))
        .map((r) => {
        const text = (0, recordText_js_1.recordText)(r);
        // the date the test was done (from the report itself) when it can be read, otherwise the upload date
        const tested = (0, recordText_js_1.clinicalDate)(text);
        const uploaded = r.createdAt ? new Date(r.createdAt) : new Date(Number(r.reportId) || Date.now());
        return { date: (tested || uploaded).toISOString(), text, source: r.fileName, reportId: r.reportId };
    })
        // newest first, so the latest value of each measurement is the one read first
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
/** The patient a request is about: patients always themselves; others must name one. */
const resolvePatient = (req, patientId) => String(req.user?.role === 'patient' ? req.user.userId : patientId || '');
/** Home and clinic readings for trends (only after the consent check in patientDocuments). */
const readingsFor = (patientId) => (patientId ? vitalsService_js_1.vitalsService.trendPoints(patientId) : []);
const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    }
    catch (err) {
        if (err instanceof HttpError) {
            res.status(err.status).json({ success: false, error: err.message });
            return;
        }
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ success: false, error: err.issues[0]?.message || 'Invalid request.' });
            return;
        }
        console.error('[AI] request failed:', err);
        res.status(500).json({ success: false, error: 'The AI assistant could not complete this request.' });
    }
};
/** Audit entry for every AI use. Only counts of removed identifiers are recorded — never the values. */
const logAi = (req, feature, patientId, engine, removed) => auditService_js_1.auditService.logEvent({
    patientId: String(patientId || req.user?.userId || 'system'),
    actorId: String(req.user?.userId || 'system'),
    actorRole: (req.user?.role || 'system'),
    action: 'AI_ANALYSIS',
    details: { feature, engine, ...(removed ? { identifiersRemoved: removed } : {}) }
});
class AIController {
    /** POST /api/ai/summarize — plain-language summary + abnormal values (Guide §6.2/6.3). */
    summarize = handle(async (req, res) => {
        const body = summarizeSchema.parse(req.body || {});
        let text = body.reportText?.trim() || '';
        let patientId = body.patientId;
        if (!text) {
            const docs = await patientDocuments(req, body.patientId, body.reportId);
            text = docs.map((d) => d.text).join('\n\n');
            patientId = req.user?.role === 'patient' ? req.user.userId : body.patientId;
            if (!text.trim())
                throw new HttpError(404, 'No report text was found to analyse. Paste the report text or upload a report first.');
        }
        const result = await aiService_js_1.aiService.summarizeReport(text, knownNames(req));
        await logAi(req, 'summary', patientId, result.engine, result.deidentification.categoryCounts);
        // Top-level fields kept for older clients
        res.status(200).json({ success: true, message: 'AI summary generated.', data: result, ...result });
    });
    /** POST /api/ai/analyze — the three abnormal-detection layers. */
    analyze = handle(async (req, res) => {
        const body = summarizeSchema.parse(req.body || {});
        const text = body.reportText?.trim() || (await patientDocuments(req, body.patientId, body.reportId)).map((d) => d.text).join('\n\n');
        if (!text.trim())
            throw new HttpError(404, 'No report text was found to analyse.');
        const result = await aiService_js_1.aiService.analyzeAbnormal(text, knownNames(req));
        res.status(200).json({ success: true, data: result });
    });
    /** POST /api/ai/drug — interactions and allergy checks. */
    checkDrugInteractions = handle(async (req, res) => {
        const body = drugSchema.parse(req.body || {});
        const result = await aiService_js_1.aiService.checkDrugInteractions(body.medications, body.allergies || []);
        res.status(200).json({ success: true, data: result, ...result });
    });
    /** POST /api/ai/drug-info — plain-language explanation of one medicine. */
    drugInfo = handle(async (req, res) => {
        const body = drugInfoSchema.parse(req.body || {});
        res.status(200).json({ success: true, data: await aiService_js_1.aiService.drugInfo(body.name) });
    });
    /** POST /api/ai/trends — how the patient's values change across their records. */
    trends = handle(async (req, res) => {
        const body = patientTextSchema.parse(req.body || {});
        const docs = await patientDocuments(req, body.patientId);
        const pid = resolvePatient(req, body.patientId);
        const result = await aiService_js_1.aiService.analyzeTrends(docs, knownNames(req), undefined, readingsFor(pid));
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ success: true, data: result });
    });
    /** POST /api/ai/risk — rule-based risk flags. */
    risk = handle(async (req, res) => {
        const body = patientTextSchema.parse(req.body || {});
        const text = body.reportText?.trim() || (await patientDocuments(req, body.patientId)).map((d) => d.text).join('\n\n');
        res.status(200).json({ success: true, data: aiService_js_1.aiService.healthRisks(text, knownNames(req)) });
    });
    /** POST /api/ai/chat — multi-turn assistant grounded in the patient's own records (Guide §6.6). */
    chat = handle(async (req, res) => {
        const body = chatSchema.parse(req.body || {});
        const docs = await patientDocuments(req, body.patientId); // consent is checked here
        const pid = resolvePatient(req, body.patientId);
        const context = docs.map((d) => `[${d.source || 'record'}]\n${d.text}`).join('\n\n');
        const trends = await aiService_js_1.aiService.analyzeTrends(docs, knownNames(req), undefined, readingsFor(pid), { narrative: false });
        const owner = String(req.user?.userId || '');
        const threadKey = pid || 'general';
        const history = body.message
            ? [
                ...(chatStore_js_1.chatStore.get(owner, threadKey)?.messages || []).slice(-5).map((m) => ({ role: m.role, content: m.content })),
                { role: 'user', content: body.message }
            ]
            : body.messages || [];
        const result = await aiService_js_1.aiService.chat(history, context, knownNames(req), undefined, trends.series);
        await logAi(req, 'chat', pid || undefined, result.engine);
        let saved = [];
        if (body.message) {
            saved = chatStore_js_1.chatStore.append(owner, threadKey, [
                { role: 'user', content: body.message },
                { role: 'assistant', content: result.reply, engine: result.engine, sources: result.sources }
            ]);
        }
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ success: true, data: { ...result, messages: saved } });
    });
    /** GET /api/ai/chat/history — the saved conversation (patients: their own; clinicians: per patient, with consent). */
    chatHistory = handle(async (req, res) => {
        const q = historyQuery.parse(req.query || {});
        const pid = resolvePatient(req, q.patientId);
        if (pid && req.user?.role !== 'patient' && !(await (0, accessPolicy_js_1.canReadPatientRecords)(req.user, pid))) {
            throw new HttpError(403, "You do not have the patient's permission to see this conversation.");
        }
        const thread = chatStore_js_1.chatStore.get(String(req.user?.userId || ''), pid || 'general');
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ success: true, data: { messages: (thread?.messages || []).slice(-100) } });
    });
    /** DELETE /api/ai/chat/history — start a new conversation. */
    clearChat = handle(async (req, res) => {
        const q = historyQuery.parse(req.query || {});
        chatStore_js_1.chatStore.clear(String(req.user?.userId || ''), resolvePatient(req, q.patientId) || 'general');
        res.status(200).json({ success: true });
    });
    // ---------- Clinician tools ----------
    chartSynthesis = handle(async (req, res) => {
        const body = patientTextSchema.parse(req.body || {});
        const docs = body.history?.trim()
            ? [{ date: new Date().toISOString(), text: body.history, source: 'pasted text' }]
            : await patientDocuments(req, body.patientId);
        const readings = body.history?.trim() ? [] : readingsFor(resolvePatient(req, body.patientId));
        const result = await aiService_js_1.aiService.synthesizeChart(docs, knownNames(req), undefined, readings);
        await logAi(req, 'chart-synthesis', body.patientId, result.engine);
        res.status(200).json({ success: true, data: result });
    });
    labTriage = handle(async (req, res) => {
        const body = patientTextSchema.parse(req.body || {});
        const labText = typeof body.labResults === 'string'
            ? body.labResults
            : body.labResults
                ? Object.entries(body.labResults).map(([k, v]) => `${k}: ${v}`).join('\n')
                : body.reportText || (await patientDocuments(req, body.patientId)).map((d) => d.text).join('\n\n');
        if (!labText.trim())
            throw new HttpError(404, 'No lab results were provided.');
        res.status(200).json({ success: true, data: await aiService_js_1.aiService.labTriage(labText, knownNames(req)) });
    });
    soapNote = handle(async (req, res) => {
        const body = patientTextSchema.parse(req.body || {});
        const text = body.reportText?.trim() || (await patientDocuments(req, body.patientId)).map((d) => d.text).join('\n\n');
        const result = await aiService_js_1.aiService.soapNote(text, knownNames(req));
        await logAi(req, 'soap-note', body.patientId, result.engine);
        res.status(200).json({ success: true, data: result });
    });
    /**
     * POST /api/ai/deidentify — privacy preview: shows exactly what text the AI would work with,
     * how many identifiers of each kind were removed, and whether the independent re-scan is clean.
     */
    deidentifyPreview = handle(async (req, res) => {
        const body = summarizeSchema.parse(req.body || {});
        let text = body.reportText?.trim() || '';
        let patientId = body.patientId;
        if (!text) {
            const docs = await patientDocuments(req, body.patientId, body.reportId);
            text = docs.map((d) => d.text).join('\n\n');
            patientId = req.user?.role === 'patient' ? req.user.userId : body.patientId;
            if (!text.trim())
                throw new HttpError(404, 'No report text was found. Paste the report text or upload a report first.');
        }
        const names = knownNames(req);
        const result = (0, deidentify_js_1.deidentify)(text, names);
        const residual = (0, deidentify_js_1.scanForPII)(result.text, names);
        await logAi(req, 'privacy-preview', patientId, 'local', result.categoryCounts);
        res.status(200).json({
            success: true,
            data: {
                text: result.text,
                redactions: result.redactions,
                categories: result.categories,
                categoryCounts: result.categoryCounts,
                residualFindings: residual,
                safeForExternal: residual.length === 0,
                originalLength: text.length
            }
        });
    });
    /** GET /api/ai/status — which engine is active (no secrets returned). */
    status = handle(async (_req, res) => {
        res.status(200).json({
            success: true,
            data: {
                engine: aiService_js_1.aiService.engine,
                externalModel: aiService_js_1.aiService.engine === 'openai' ? 'OpenAI (de-identified text only)' : null,
                privacy: {
                    deidentification: 'always on — applied before every AI feature',
                    failClosedGate: true,
                    ...aiService_js_1.aiService.privacyStats
                },
                features: ['privacy-preview', 'summary', 'abnormal-detection', 'drug-interactions', 'drug-info', 'trends', 'risk-flags', 'chat', 'chart-synthesis', 'lab-triage', 'soap-note']
            }
        });
    });
}
exports.AIController = AIController;
exports.aiController = new AIController();
