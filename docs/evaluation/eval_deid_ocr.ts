/**
 * Re-scores de-identification on OCR output saved by eval_ocr.ts (results/ocr_texts.json),
 * so changes to the de-identifier can be measured without running OCR again.
 *   npx --prefix apps/server tsx docs/evaluation/eval_deid_ocr.ts
 */
import fs from 'fs';
import path from 'path';
import { deidentify } from '../../apps/server/src/services/ai/deidentify.js';
import type { Report } from './dataset.js';

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'results');
const reports: Report[] = JSON.parse(fs.readFileSync(path.join(DIR, 'ocr_reports.json'), 'utf8'));
const texts: Record<string, { text: string; confidence: number }> = JSON.parse(fs.readFileSync(path.join(DIR, 'ocr_texts.json'), 'utf8'));

// same leak test as eval_ocr.ts: a name leaks if any of its words (3+ letters) survives; other details if the value (or its digits) survives
const leaked = (out: string, p: { type: string; value: string }) =>
  p.type === 'name' || p.type === 'clinician'
    ? p.value.split(/\s+/).filter((w) => w.length >= 3).some((w) => new RegExp(`\\b${w}\\b`, 'i').test(out))
    : out.toLowerCase().includes(p.value.toLowerCase()) || ((p.type === 'phone' || p.type === 'national_id') && out.replace(/\D/g, '').includes(p.value.replace(/\D/g, '')));

const result: Record<string, unknown> = {};
for (const kind of ['clean', 'degraded'] as const) {
  let total = 0, removed = 0;
  const byType: Record<string, { total: number; removed: number }> = {};
  const lowConf = { reports: 0, total: 0, removed: 0 };
  for (const r of reports) {
    const o = texts[`${r.id}_${kind}`];
    if (!o) continue;
    const out = deidentify(o.text, [r.patientName]).text;
    const low = o.confidence < 80;
    if (low) lowConf.reports++;
    for (const p of r.pii) {
      const ok = !leaked(out, p);
      total++;
      if (ok) removed++;
      const b = (byType[p.type] ||= { total: 0, removed: 0 });
      b.total++;
      if (ok) b.removed++;
      if (low) { lowConf.total++; if (ok) lowConf.removed++; }
    }
  }
  result[kind] = {
    recall: removed / total,
    total,
    removed,
    byType,
    // pages under the 80% confidence gate never reach the external model
    belowConfidenceGate: lowConf,
    reachingExternalModel: { total: total - lowConf.total, removed: removed - lowConf.removed, recall: (removed - lowConf.removed) / Math.max(1, total - lowConf.total) }
  };
}
fs.writeFileSync(path.join(DIR, process.env.DEID_OUT || 'deid_ocr_eval.json'), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
