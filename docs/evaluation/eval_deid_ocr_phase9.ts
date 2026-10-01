/**
 * Phase 9 – re-scores de-identification on the OCR text already read in Phases 6–7 (no OCR re-run),
 * with and without the registered name.  Run from apps/server:
 *   node --import tsx ../../docs/evaluation/eval_deid_ocr_phase9.ts
 */
import fs from 'fs';
import { deidentify } from '../../apps/server/src/services/ai/deidentify.js';
const leaked = (out: string, p: { type: string; value: string }) =>
  p.type === 'name' || p.type === 'clinician'
    ? p.value.split(/\s+/).filter((w) => w.length >= 3).some((w) => new RegExp(`\\b${w}\\b`, 'i').test(out))
    : out.toLowerCase().includes(p.value.toLowerCase()) || ((p.type === 'phone' || p.type === 'national_id') && out.replace(/\D/g, '').includes(p.value.replace(/\D/g, '')));
const rows: unknown[] = [];
for (const set of ['set_626262', 'set_737373']) {
  const dir = `../../docs/evaluation/results/${set}`;
  const reports = JSON.parse(fs.readFileSync(`${dir}/ocr_reports.json`, 'utf8'));
  const texts = JSON.parse(fs.readFileSync(fs.existsSync(`${dir}/ocr_texts_after.json`) ? `${dir}/ocr_texts_after.json` : `${dir}/ocr_texts.json`, 'utf8'));
  for (const kind of ['clean', 'moderate', 'degraded']) for (const names of [true, false]) {
    let n = 0, ok = 0;
    for (const r of reports) {
      const t = texts[`${r.id}_${kind}`]; if (!t) continue;
      const out = deidentify(t.text, names ? [r.patientName] : []).text;
      for (const p of r.pii) { n++; if (!leaked(out, p)) ok++; }
    }
    if (n) rows.push({ set, kind, withRegisteredName: names, identifiers: n, recall: ok / n });
    if (n) console.log(set, kind, names ? 'with name' : 'no name', (100 * ok / n).toFixed(1) + '%', n);
  }
}
fs.writeFileSync('../../docs/evaluation/results/ocr_deid_phase9.json', JSON.stringify(rows, null, 1));
