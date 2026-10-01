/**
 * Phase 11 – the clinical engine on REAL lab reports, labelled by hand.
 *
 *   Put the anonymised files (PDF, JPG, PNG) in docs/study/data/reports/ and fill docs/study/data/labels.csv
 *   (copy templates/labels.csv). Then, from apps/server:
 *     node --import tsx ../../docs/study/eval_real_reports.ts
 *   Options: STUDY_DIR (default docs/study/data), REAL_OUT (default docs/study/results/real_reports_eval.json)
 *
 * For each labelled value: was it found with the right number (value recall), and does the engine's
 * low / normal / high agree with the flag the laboratory printed? Also: spurious values, OCR confidence,
 * time per page, and a scan for personal details the anonymisation may have missed.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractDocumentText } from '../../apps/server/src/services/documentText.js';
import { markUncertain } from '../../apps/server/src/services/recordText.js';
import { extractClinicalData } from '../../apps/server/src/services/ai/clinicalExtractor.js';
import { LAB_TESTS } from '../../apps/server/src/services/ai/labReference.js';
import { scanForPII } from '../../apps/server/src/services/ai/deidentify.js';
import { parseCsv, wilson } from './scoring.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(process.env.STUDY_DIR || path.join(here, 'data'));
const OUT = path.resolve(process.env.REAL_OUT || path.join(here, 'results', 'real_reports_eval.json'));
const MIME: Record<string, string> = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/** Test name as printed ("Haemoglobin", "S. Creatinine") → engine key, using the engine's own aliases. */
const keyFor = (name: string, given?: string): string | null => {
  if (given) return LAB_TESTS.some((t) => t.key === given) ? given : null;
  const n = name.trim();
  for (const t of LAB_TESTS) {
    if (t.key === n.toLowerCase() || t.label.toLowerCase() === n.toLowerCase()) return t.key;
    if (new RegExp(`^(?:${t.aliases})$`, 'i').test(n)) return t.key;
  }
  return null;
};

/** The labelled value in the engine's unit (the engine converts mmol/L, µmol/L … the same way). */
const toCanonical = (key: string, value: number, unit: string): number => {
  const t = LAB_TESTS.find((x) => x.key === key)!;
  const u = unit.trim();
  if (!u || u.toLowerCase().replace(/\s/g, '') === t.unit.toLowerCase().replace(/\s/g, '')) return value;
  const other = t.otherUnits?.find((o) => o.pattern.test(u));
  return other ? Math.round(value * other.factor * 100) / 100 : value;
};

const flagOf = (f: string): 'low' | 'normal' | 'high' | null => {
  const x = f.trim().toLowerCase();
  if (!x) return null;
  if (/^(h|high|↑|\*h)$/.test(x)) return 'high';
  if (/^(l|low|↓|\*l)$/.test(x)) return 'low';
  if (/^(n|normal|-)$/.test(x)) return 'normal';
  return null;
};

(async () => {
  const labelsFile = path.join(DIR, 'labels.csv');
  if (!fs.existsSync(labelsFile)) throw new Error(`No labels at ${labelsFile}. Copy docs/study/templates/labels.csv there and fill it in.`);
  const labels = parseCsv(fs.readFileSync(labelsFile, 'utf8'));
  const byFile = new Map<string, typeof labels>();
  for (const l of labels) {
    if (!l.file) continue;
    if (!byFile.has(l.file)) byFile.set(l.file, []);
    byFile.get(l.file)!.push(l);
  }

  const perCapture: Record<string, { values: number; found: number; flagged: number; flagAgree: number; spurious: number; pages: number; seconds: number; confidence: number[] }> = {};
  const misses: string[] = [];
  const unknownTests = new Set<string>();
  const piiLeft: Array<{ file: string; categories: string[] }> = [];
  for (const [file, rows] of byFile) {
    const full = path.join(DIR, 'reports', file);
    if (!fs.existsSync(full)) { misses.push(`${file}: file not found`); continue; }
    const capture = (rows[0].capture || 'unknown').toLowerCase();
    const c = (perCapture[capture] ??= { values: 0, found: 0, flagged: 0, flagAgree: 0, spurious: 0, pages: 0, seconds: 0, confidence: [] });
    const t0 = Date.now();
    const res = await extractDocumentText(fs.readFileSync(full), MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    c.seconds += (Date.now() - t0) / 1000;
    c.pages += res.pages || 1;
    if (res.confidence != null) c.confidence.push(res.confidence);
    const ex = extractClinicalData(markUncertain(res.text, res.uncertainNumbers));
    const pii = scanForPII(res.text);
    if (pii.length) piiLeft.push({ file, categories: [...new Set(pii.map((p) => p.category))] });

    const wanted = new Set<string>();
    for (const r of rows) {
      const key = keyFor(r.test, r.key);
      if (!key) { unknownTests.add(r.test); continue; }
      wanted.add(key);
      const truth = toCanonical(key, Number(r.value), r.unit || '');
      c.values++;
      const g = ex.values.find((v) => v.key === key && Math.abs(v.value - truth) <= Math.max(0.011, Math.abs(truth) * 0.001));
      if (g) c.found++;
      else misses.push(`${file}: ${r.test} ${r.value} ${r.unit} → ${ex.values.filter((v) => v.key === key).map((v) => v.value).join(', ') || 'not found'}`);
      const flag = flagOf(r.flag_on_report || '');
      if (g && flag) { c.flagged++; if (g.status === flag) c.flagAgree++; else misses.push(`${file}: ${r.test} flag ${flag}, engine ${g.status} (${g.referenceRange})`); }
    }
    c.spurious += ex.values.filter((v) => !wanted.has(v.key)).length;
  }

  const total = Object.values(perCapture).reduce((a, c) => ({ values: a.values + c.values, found: a.found + c.found, flagged: a.flagged + c.flagged, flagAgree: a.flagAgree + c.flagAgree }), { values: 0, found: 0, flagged: 0, flagAgree: 0 });
  const result = {
    reports: byFile.size,
    labelledValues: total.values,
    valueRecall: wilson(total.found, total.values),
    flagAgreement: wilson(total.flagAgree, total.flagged),
    target: { valueRecallOnPrinted: 0.95 },
    byCapture: Object.fromEntries(Object.entries(perCapture).map(([k, c]) => [k, {
      values: c.values, valueRecall: wilson(c.found, c.values), flagAgreement: wilson(c.flagAgree, c.flagged),
      spuriousValues: c.spurious, secondsPerPage: c.seconds / Math.max(1, c.pages),
      meanOcrConfidence: c.confidence.length ? c.confidence.reduce((a, b) => a + b, 0) / c.confidence.length : null
    }])),
    testsNotRecognised: [...unknownTests],
    reportsWithPossiblePersonalDetails: piiLeft,
    misses,
    measuredAt: new Date().toISOString()
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  const p = (x: number) => (100 * x).toFixed(1) + '%';
  console.log(`${byFile.size} reports, ${total.values} labelled values`);
  for (const [k, v] of Object.entries(result.byCapture)) console.log(`  ${k.padEnd(8)} recall ${p(v.valueRecall.rate)} [${p(v.valueRecall.low)}–${p(v.valueRecall.high)}]  flag agreement ${p(v.flagAgreement.rate)}  ${v.secondsPerPage.toFixed(1)} s/page`);
  if (unknownTests.size) console.log('  test names the engine does not know (add a key column or an alias):', [...unknownTests].join(', '));
  if (piiLeft.length) console.log(`  ${piiLeft.length} report(s) may still contain personal details — check the anonymisation`);
  console.log(`saved ${path.relative(process.cwd(), OUT)}`);
  process.exit(0);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
