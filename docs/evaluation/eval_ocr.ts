/**
 * OCR robustness: reads the rendered clean scans and degraded photos with the server's own
 * Tesseract pipeline, then measures character error rate and how many lab values and personal
 * details survive.  Run after render_scans.py:  npx tsx docs/evaluation/eval_ocr.ts
 */
import fs from 'fs';
import path from 'path';
import { extractDocumentText, shutdownOcr } from '../../apps/server/src/services/documentText.js';
import { extractClinicalData } from '../../apps/server/src/services/ai/clinicalExtractor.js';
import { deidentify } from '../../apps/server/src/services/ai/deidentify.js';
import { markUncertain } from '../../apps/server/src/services/recordText.js';
import type { Report } from './dataset.js';

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'results');
// REPORTS / SCANS / LEVELS / LIMIT / OCR_OUT / TEXTS_OUT select the set; defaults are the published run
const reportsAll: Report[] = JSON.parse(fs.readFileSync(process.env.REPORTS || path.join(DIR, 'ocr_reports.json'), 'utf8'));
const reports = process.env.LIMIT ? reportsAll.slice(0, Number(process.env.LIMIT)) : reportsAll;
const SCANS = process.env.SCANS || path.join(DIR, 'scans');
const LEVELS = (process.env.LEVELS || 'clean,degraded').split(',') as Array<'clean' | 'moderate' | 'degraded'>;
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
function cer(ref: string, hyp: string) {
  const a = norm(ref), b = norm(hyp);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] / a.length;
}
const leaked = (out: string, p: { type: string; value: string }) =>
  p.type === 'name' || p.type === 'clinician'
    ? p.value.split(/\s+/).filter((w) => w.length >= 3).some((w) => new RegExp(`\\b${w}\\b`, 'i').test(out))
    : out.toLowerCase().includes(p.value.toLowerCase()) || ((p.type === 'phone' || p.type === 'national_id') && out.replace(/\D/g, '').includes(p.value.replace(/\D/g, '')));

const texts: Record<string, { text: string; confidence: number }> = {};
async function run(kind: 'clean' | 'moderate' | 'degraded') {
  let cerSum = 0, ms = 0, found = 0, total = 0, tp = 0, fp = 0, fn = 0, pii = 0, piiRemoved = 0, conf = 0;
  let extracted = 0, wrong = 0, wrongFlagged = 0, rightFlagged = 0, cleaned = 0;
  for (const r of reports) {
    const file = path.join(SCANS, `${r.id}_${kind}.${kind === 'clean' ? 'png' : 'jpg'}`);
    const t0 = performance.now();
    // the same entry point an upload uses (clean-up, OCR and text fixes included)
    const res = await extractDocumentText(fs.readFileSync(file), kind === 'clean' ? 'image/png' : 'image/jpeg');
    const o = { text: res.text, confidence: res.confidence ?? 0 };
    if (res.cleanedPhoto) cleaned++;
    ms += performance.now() - t0; conf += o.confidence;
    texts[`${r.id}_${kind}`] = { text: o.text, confidence: o.confidence };
    cerSum += cer(r.text, o.text);
    // the AI reads the text with low-confidence numbers marked, exactly as recordText() builds it
    const ex = extractClinicalData(markUncertain(o.text, res.uncertainNumbers));
    const truth = r.labs.map((l) => ({ key: l.key, value: l.value, status: l.status }));
    if (r.bp) truth.push({ key: 'systolic_bp', value: r.bp.sys, status: r.bp.sys > 120 ? 'high' : 'normal' } as never, { key: 'diastolic_bp', value: r.bp.dia, status: r.bp.dia > 80 ? 'high' : r.bp.dia < 60 ? 'low' : 'normal' } as never);
    for (const t of truth) {
      total++;
      const g = ex.values.find((v) => v.key === t.key);
      const ok = g && Math.abs(g.value - t.value) <= Math.max(0.011, Math.abs(t.value) * 0.001);
      if (ok) found++;
      if (g) {
        extracted++;
        if (!ok) { wrong++; if (g.uncertain) wrongFlagged++; }
        else if (g.uncertain) rightFlagged++;
      }
      const abn = t.status !== 'normal', flag = Boolean(ok && g!.status !== 'normal');
      if (abn && flag) tp++; else if (abn) fn++; else if (flag) fp++;
    }
    const out = deidentify(o.text, [r.patientName]).text;
    for (const p of r.pii) { pii++; if (!leaked(out, p)) piiRemoved++; }
  }
  const n = reports.length, P = tp / (tp + fp), R = tp / (tp + fn);
  return {
    kind, pages: n, cer: cerSum / n, secondsPerPage: ms / n / 1000, meanConfidence: conf / n,
    valueRecall: found / total, abnormalF1: (2 * P * R) / (P + R), abnormalPrecision: P, abnormalRecall: R, deidRecall: piiRemoved / pii,
    // values read wrongly (misread digits), and how many of them were flagged "check against the report"
    valuesExtracted: extracted, wrongValues: wrong, wrongValueRate: wrong / Math.max(1, extracted), wrongFlagged, unflaggedWrongRate: (wrong - wrongFlagged) / Math.max(1, extracted),
    correctButFlagged: rightFlagged, cleanedPages: cleaned
  };
}
(async () => {
  const out: Record<string, unknown> = {};
  for (const level of LEVELS) {
    out[level] = await run(level);
    console.error(level, JSON.stringify(out[level]));
  }
  await shutdownOcr();
  // OCR output is kept so text-only steps (de-identification) can be re-scored without re-running OCR
  fs.writeFileSync(process.env.TEXTS_OUT || path.join(DIR, 'ocr_texts.json'), JSON.stringify(texts));
  fs.writeFileSync(process.env.OCR_OUT ? path.resolve(DIR, process.env.OCR_OUT) : path.join(DIR, 'ocr_eval.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})();
