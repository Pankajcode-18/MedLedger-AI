import { Response } from 'express';
import { z } from 'zod';
import { aiService, aiScope } from '../services/aiService.js';
import { config } from '../config/index.js';
import { deidentify, scanForPII } from '../services/ai/deidentify.js';
import { stateStore } from '../models/stateStore.js';
import { canReadPatientRecords } from '../services/accessPolicy.js';
import { recordText, clinicalDate } from '../services/recordText.js';
import { vitalsService } from '../services/vitalsService.js';
import { chatStore } from '../services/chatStore.js';
import { auditService } from '../services/auditService.js';
import { AuthenticatedRequest, UserRole } from '../types/index.js';

const MAX_TEXT = 20_000;

const textSchema = z.string().max(MAX_TEXT, 'Report text is too long (max 20,000 characters).').optional();
const summarizeSchema = z.object({ reportText: textSchema, patientId: z.string().max(64).optional(), reportId: z.string().max(64).optional() });
const drugSchema = z.object({
  medications: z.array(z.string().max(80)).min(1, 'Enter at least one medicine.').max(20),
  allergies: z.array(z.string().max(60)).max(10).optional()
});
const drugInfoSchema = z.object({ name: z.string().min(2, 'Enter a medicine name.').max(80) });
const chatSchema = z
  .object({
    /** one new question — the saved conversation supplies the history */
    message: z.string().trim().min(1, 'Please type a question.').max(2000).optional(),
    /** older clients send the recent messages themselves */
    messages: z
      .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(2000) }))
      .min(1)
      .max(20)
      .optional(),
    patientId: z.string().max(64).optional()
  })
  .refine((b) => b.message || b.messages, { message: 'Please type a question.' });
const historyQuery = z.object({ patientId: z.string().max(64).optional() });
const patientTextSchema = z.object({
  patientId: z.string().max(64).optional(),
  reportText: textSchema,
  history: textSchema,
  labResults: z.union([z.string().max(MAX_TEXT), z.record(z.unknown())]).optional()
});

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Every person name the system knows about — removed from text before any AI processing. */
const knownNames = (req: AuthenticatedRequest): string[] => {
  const s = stateStore.getState();
  return [
    ...s.patients.map((p) => p.name),
    ...s.doctors.map((d) => d.name),
    // people only: organisation accounts ("Suraksha Health Insurance") would turn ordinary words into "names"
    ...(s.users || []).filter((u) => u.role === 'patient' || u.role === 'doctor').map((u) => u.name),
    ['patient', 'doctor'].includes(String(req.user?.role)) ? req.user?.name || '' : ''
  ].filter((n) => n && n.length >= 3);
};

/** Loads a patient's record texts, enforcing consent. */
const patientDocuments = async (req: AuthenticatedRequest, patientId?: string, reportId?: string) => {
  const user = req.user;
  const pid = String(user?.role === 'patient' ? user.userId : patientId || '');
  if (!pid) return [];
  if (!(await canReadPatientRecords(user, pid))) {
    throw new HttpError(403, 'You do not have the patient\'s permission to analyse their records. Request access first.');
  }
  const reports = stateStore.getState().reports.filter((r) => String(r.patientId) === pid && (!reportId || r.reportId === reportId));
  // A poorly read scan or photo keeps the whole request on the built-in engine (see config.aiMinOcrConfidence).
  const lowQuality = reports.filter((r) => isLowQualityOcr(r.textExtraction));
  const scope = aiScope.getStore();
  if (scope && lowQuality.length && !scope.localOnly) {
    scope.localOnly =
      lowQuality.length === 1
        ? `“${lowQuality[0].fileName || 'A scanned report'}” was read from an unclear image, so only the built-in assistant was used. Check and correct its text to allow the full assistant.`
        : `${lowQuality.length} reports were read from unclear images, so only the built-in assistant was used. Check and correct their text to allow the full assistant.`;
  }
  return reports
    .map((r) => {
      const text = recordText(r);
      // the date the test was done (from the report itself) when it can be read, otherwise the upload date
      const tested = clinicalDate(text);
      const uploaded = r.createdAt ? new Date(r.createdAt) : new Date(Number(r.reportId) || Date.now());
      return { date: (tested || uploaded).toISOString(), text, source: r.fileName, reportId: r.reportId };
    })
    // newest first, so the latest value of each measurement is the one read first
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

/** OCR text too uncertain to trust de-identification on (unless a person has checked and corrected it). */
export const isLowQualityOcr = (t?: { method?: string; confidence?: number | null; corrected?: boolean; cleanedPhoto?: boolean }): boolean =>
  Boolean(
    t &&
      !t.corrected &&
      String(t.method || '').includes('ocr') &&
      // a noisy photo that needed clean-up can read confidently yet still garble names, so it waits for a person's check
      (t.cleanedPhoto || (t.confidence ?? 0) < config.aiMinOcrConfidence)
  );

/** The patient a request is about: patients always themselves; others must name one. */
const resolvePatient = (req: AuthenticatedRequest, patientId?: string): string =>
  String(req.user?.role === 'patient' ? req.user.userId : patientId || '');

/** Home and clinic readings for trends (only after the consent check in patientDocuments). */
const readingsFor = (patientId: string) => (patientId ? vitalsService.trendPoints(patientId) : []);

const handle =
  (fn: (req: AuthenticatedRequest, res: Response) => Promise<void>) =>
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const scope: { localOnly?: string; names: string[] } = { names: knownNames(req) };
    // tell the user when (and why) the external model was not used for this answer
    const json = res.json.bind(res);
    res.json = (body: unknown) => {
      const b = body as { success?: boolean; data?: unknown };
      if (scope.localOnly && aiService.engine === 'openai' && b && b.success && b.data && typeof b.data === 'object' && !Array.isArray(b.data)) {
        (b.data as Record<string, unknown>).privacyNotice = scope.localOnly;
      }
      return json(body);
    };
    try {
      await aiScope.run(scope, () => fn(req, res));
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ success: false, error: err.message });
        return;
      }
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.issues[0]?.message || 'Invalid request.' });
        return;
      }
      console.error('[AI] request failed:', err);
      res.status(500).json({ success: false, error: 'The AI assistant could not complete this request.' });
    }
  };

/** Audit entry for every AI use. Only counts of removed identifiers are recorded — never the values. */
const logAi = (req: AuthenticatedRequest, feature: string, patientId?: string, engine?: string, removed?: Record<string, number>) =>
  auditService.logEvent({
    patientId: String(patientId || req.user?.userId || 'system'),
    actorId: String(req.user?.userId || 'system'),
    actorRole: (req.user?.role || 'system') as UserRole,
    action: 'AI_ANALYSIS',
    details: { feature, engine, ...(removed ? { identifiersRemoved: removed } : {}) }
  });

export class AIController {
  /** POST /api/ai/summarize — plain-language summary + abnormal values (Guide §6.2/6.3). */
  public summarize = handle(async (req, res) => {
    const body = summarizeSchema.parse(req.body || {});
    let text = body.reportText?.trim() || '';
    let patientId = body.patientId;

    if (!text) {
      const docs = await patientDocuments(req, body.patientId, body.reportId);
      text = docs.map((d) => d.text).join('\n\n');
      patientId = req.user?.role === 'patient' ? req.user.userId : body.patientId;
      if (!text.trim()) throw new HttpError(404, 'No report text was found to analyse. Paste the report text or upload a report first.');
    }

    const result = await aiService.summarizeReport(text, knownNames(req));
    await logAi(req, 'summary', patientId, result.engine, result.deidentification.categoryCounts);
    // Top-level fields kept for older clients
    res.status(200).json({ success: true, message: 'AI summary generated.', data: result, ...result });
  });

  /** POST /api/ai/analyze — the three abnormal-detection layers. */
  public analyze = handle(async (req, res) => {
    const body = summarizeSchema.parse(req.body || {});
    const text = body.reportText?.trim() || (await patientDocuments(req, body.patientId, body.reportId)).map((d) => d.text).join('\n\n');
    if (!text.trim()) throw new HttpError(404, 'No report text was found to analyse.');
    const result = await aiService.analyzeAbnormal(text, knownNames(req));
    res.status(200).json({ success: true, data: result });
  });

  /** POST /api/ai/drug — interactions and allergy checks. */
  public checkDrugInteractions = handle(async (req, res) => {
    const body = drugSchema.parse(req.body || {});
    const result = await aiService.checkDrugInteractions(body.medications, body.allergies || []);
    res.status(200).json({ success: true, data: result, ...result });
  });

  /** POST /api/ai/drug-info — plain-language explanation of one medicine. */
  public drugInfo = handle(async (req, res) => {
    const body = drugInfoSchema.parse(req.body || {});
    res.status(200).json({ success: true, data: await aiService.drugInfo(body.name) });
  });

  /** POST /api/ai/trends — how the patient's values change across their records. */
  public trends = handle(async (req, res) => {
    const body = patientTextSchema.parse(req.body || {});
    const docs = await patientDocuments(req, body.patientId);
    const pid = resolvePatient(req, body.patientId);
    const result = await aiService.analyzeTrends(docs, knownNames(req), undefined, readingsFor(pid));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: result });
  });

  /** POST /api/ai/risk — rule-based risk flags. */
  public risk = handle(async (req, res) => {
    const body = patientTextSchema.parse(req.body || {});
    const text = body.reportText?.trim() || (await patientDocuments(req, body.patientId)).map((d) => d.text).join('\n\n');
    res.status(200).json({ success: true, data: aiService.healthRisks(text, knownNames(req)) });
  });

  /** POST /api/ai/chat — multi-turn assistant grounded in the patient's own records (Guide §6.6). */
  public chat = handle(async (req, res) => {
    const body = chatSchema.parse(req.body || {});
    const docs = await patientDocuments(req, body.patientId); // consent is checked here
    const pid = resolvePatient(req, body.patientId);
    const context = docs.map((d) => `[${d.source || 'record'}]\n${d.text}`).join('\n\n');
    const trends = await aiService.analyzeTrends(docs, knownNames(req), undefined, readingsFor(pid), { narrative: false });

    const owner = String(req.user?.userId || '');
    const threadKey = pid || 'general';
    const history = body.message
      ? [
          ...(chatStore.get(owner, threadKey)?.messages || []).slice(-5).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user' as const, content: body.message }
        ]
      : body.messages || [];

    const result = await aiService.chat(history, context, knownNames(req), undefined, trends.series);
    await logAi(req, 'chat', pid || undefined, result.engine);

    let saved: unknown[] = [];
    if (body.message) {
      saved = chatStore.append(owner, threadKey, [
        { role: 'user', content: body.message },
        { role: 'assistant', content: result.reply, engine: result.engine, sources: result.sources }
      ]);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { ...result, messages: saved } });
  });

  /** GET /api/ai/chat/history — the saved conversation (patients: their own; clinicians: per patient, with consent). */
  public chatHistory = handle(async (req, res) => {
    const q = historyQuery.parse(req.query || {});
    const pid = resolvePatient(req, q.patientId);
    if (pid && req.user?.role !== 'patient' && !(await canReadPatientRecords(req.user, pid))) {
      throw new HttpError(403, "You do not have the patient's permission to see this conversation.");
    }
    const thread = chatStore.get(String(req.user?.userId || ''), pid || 'general');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { messages: (thread?.messages || []).slice(-100) } });
  });

  /** DELETE /api/ai/chat/history — start a new conversation. */
  public clearChat = handle(async (req, res) => {
    const q = historyQuery.parse(req.query || {});
    chatStore.clear(String(req.user?.userId || ''), resolvePatient(req, q.patientId) || 'general');
    res.status(200).json({ success: true });
  });

  // ---------- Clinician tools ----------

  public chartSynthesis = handle(async (req, res) => {
    const body = patientTextSchema.parse(req.body || {});
    const docs = body.history?.trim()
      ? [{ date: new Date().toISOString(), text: body.history, source: 'pasted text' }]
      : await patientDocuments(req, body.patientId);
    const readings = body.history?.trim() ? [] : readingsFor(resolvePatient(req, body.patientId));
    const result = await aiService.synthesizeChart(docs, knownNames(req), undefined, readings);
    await logAi(req, 'chart-synthesis', body.patientId, result.engine);
    res.status(200).json({ success: true, data: result });
  });

  public labTriage = handle(async (req, res) => {
    const body = patientTextSchema.parse(req.body || {});
    const labText =
      typeof body.labResults === 'string'
        ? body.labResults
        : body.labResults
          ? Object.entries(body.labResults).map(([k, v]) => `${k}: ${v}`).join('\n')
          : body.reportText || (await patientDocuments(req, body.patientId)).map((d) => d.text).join('\n\n');
    if (!labText.trim()) throw new HttpError(404, 'No lab results were provided.');
    res.status(200).json({ success: true, data: await aiService.labTriage(labText, knownNames(req)) });
  });

  public soapNote = handle(async (req, res) => {
    const body = patientTextSchema.parse(req.body || {});
    const text = body.reportText?.trim() || (await patientDocuments(req, body.patientId)).map((d) => d.text).join('\n\n');
    const result = await aiService.soapNote(text, knownNames(req));
    await logAi(req, 'soap-note', body.patientId, result.engine);
    res.status(200).json({ success: true, data: result });
  });

  /**
   * POST /api/ai/deidentify — privacy preview: shows exactly what text the AI would work with,
   * how many identifiers of each kind were removed, and whether the independent re-scan is clean.
   */
  public deidentifyPreview = handle(async (req, res) => {
    const body = summarizeSchema.parse(req.body || {});
    let text = body.reportText?.trim() || '';
    let patientId = body.patientId;
    if (!text) {
      const docs = await patientDocuments(req, body.patientId, body.reportId);
      text = docs.map((d) => d.text).join('\n\n');
      patientId = req.user?.role === 'patient' ? req.user.userId : body.patientId;
      if (!text.trim()) throw new HttpError(404, 'No report text was found. Paste the report text or upload a report first.');
    }
    const names = knownNames(req);
    const result = deidentify(text, names);
    const residual = scanForPII(result.text, names);
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
  public status = handle(async (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        engine: aiService.engine,
        externalModel: aiService.engine === 'openai' ? 'OpenAI (de-identified text only)' : null,
        privacy: {
          deidentification: 'always on — applied before every AI feature',
          failClosedGate: true,
          ...aiService.privacyStats
        },
        features: ['privacy-preview', 'summary', 'abnormal-detection', 'drug-interactions', 'drug-info', 'trends', 'risk-flags', 'chat', 'chart-synthesis', 'lab-triage', 'soap-note']
      }
    });
  });
}

export const aiController = new AIController();
