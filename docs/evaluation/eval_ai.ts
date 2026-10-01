/**
 * Evaluates the de-identification step, lab-value extraction and abnormal-value detection,
 * and the drug-interaction checker on synthetic data.  Run: npx tsx docs/evaluation/eval_ai.ts
 */
import fs from 'fs';
import path from 'path';
import { makeDataset, Report, rng, TEST_SEED } from './dataset.js';
import { deidentify } from '../../apps/server/src/services/ai/deidentify.js';
import { extractClinicalData } from '../../apps/server/src/services/ai/clinicalExtractor.js';
import { DRUGS, INTERACTIONS, checkInteractions } from '../../apps/server/src/services/ai/drugKnowledge.js';

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'results');
fs.mkdirSync(OUT, { recursive: true });
const N = Number(process.env.N || 500);
const SEED = Number(process.env.SEED || TEST_SEED);
const HARD = process.env.HARD === '1';
const TAG = process.env.AI_OUT || (HARD ? `ai_eval_hard_${SEED}` : 'ai_eval');
const data = makeDataset(N, SEED, { hard: HARD });
fs.writeFileSync(path.join(OUT, `${TAG}_sample.json`), JSON.stringify(data.slice(0, 5), null, 1));

// ---------- de-identification ----------
type P = Report['pii'][number];
const leaked = (out: string, p: { type: string; value: string }) => {
  if (p.type === 'name' || p.type === 'clinician' || p.type === 'relative') {
    const words = p.value.split(/\s+/);
    // \b does not work for Devanagari in JavaScript, so use Unicode letter and mark classes ("राम" inside "बिरामीको" is not a leak)
    if (/[\u0900-\u097F]/.test(p.value)) return words.some((w) => new RegExp(`(?<![\\p{L}\\p{M}])${w}(?![\\p{L}\\p{M}])`, 'u').test(out));
    return words.filter((w) => w.length >= 3).some((w) => new RegExp(`\\b${w}\\b`, 'i').test(out));
  }
  const v = p.value.toLowerCase();
  if (out.toLowerCase().includes(v)) return true;
  if (p.type === 'phone' || p.type === 'national_id') {
    const d = p.value.replace(/\D/g, '');
    return out.replace(/\D/g, ' ').split(/\s+/).some((chunk) => chunk.length >= 7 && d.includes(chunk)) || out.replace(/\D/g, '').includes(d);
  }
  return false;
};
function deidRun(withNames: boolean) {
  const byType: Record<string, { total: number; removed: number }> = {};
  const byCtx: Record<string, { total: number; removed: number }> = {};
  // hard set: names in and outside the de-identifier's list of common names, and names in Devanagari
  const byGroup: Record<string, { total: number; removed: number }> = {};
  const group = (p: P) => (p.script === 'devanagari' ? 'devanagari' : p.rareName ? 'name not in list' : p.rareName === false || p.type === 'relative' ? 'name in list' : null);
  const misses: string[] = [];
  let reportsClean = 0;
  const t0 = performance.now();
  for (const r of data) {
    const out = deidentify(r.text, withNames ? [r.patientName] : []).text;
    let clean = true;
    for (const p of r.pii) {
      const k = p.type;
      byType[k] ??= { total: 0, removed: 0 };
      byCtx[p.context] ??= { total: 0, removed: 0 };
      byType[k].total++; byCtx[p.context].total++;
      const g = group(p);
      if (g) { byGroup[g] ??= { total: 0, removed: 0 }; byGroup[g].total++; }
      if (!leaked(out, p)) { byType[k].removed++; byCtx[p.context].removed++; if (g) byGroup[g].removed++; } else { clean = false; if (misses.length < 40) misses.push(`${p.type}: ${p.value}`); }
    }
    if (clean) reportsClean++;
  }
  const ms = (performance.now() - t0) / data.length;
  const total = Object.values(byType).reduce((a, b) => a + b.total, 0);
  const removed = Object.values(byType).reduce((a, b) => a + b.removed, 0);
  return { withNames, recall: removed / total, total, removed, reportsFullyClean: reportsClean / data.length, msPerReport: ms, byType, byCtx, byGroup, misses };
}

// ---------- lab extraction ----------
type Counts = { tp: number; fp: number; fn: number };
const mismatches: string[] = [];
function extractionRun(texts: (r: Report) => string) {
  const byFormat: Record<string, { found: number; total: number; correct: number }> = {};
  const byKey: Record<string, { found: number; total: number }> = {};
  const abn: Counts & { tn: number } = { tp: 0, fp: 0, fn: 0, tn: 0 };
  let extra = 0, statusRight = 0, statusTotal = 0;
  for (const r of data) {
    const ex = extractClinicalData(texts(r));
    const got = new Map(ex.values.map((v) => [v.key, v]));
    const truth = [...r.labs.map((l) => ({ key: l.key, value: l.value, status: l.status, format: l.format }))];
    if (r.bp) {
      const s = r.bp.sys > 120 ? 'high' : r.bp.sys < 90 ? 'low' : 'normal';
      const d = r.bp.dia > 80 ? 'high' : r.bp.dia < 60 ? 'low' : 'normal';
      truth.push({ key: 'systolic_bp', value: r.bp.sys, status: s as never, format: 'bp' as never }, { key: 'diastolic_bp', value: r.bp.dia, status: d as never, format: 'bp' as never });
    }
    const truthKeys = new Set(truth.map((t) => t.key));
    for (const t of truth) {
      byFormat[t.format] ??= { found: 0, total: 0, correct: 0 };
      byKey[t.key] ??= { found: 0, total: 0 };
      byFormat[t.format].total++; byKey[t.key].total++;
      const g = got.get(t.key);
      const valueOk = g && Math.abs(g.value - t.value) <= Math.max(0.011, Math.abs(t.value) * 0.001);
      if (valueOk) {
        byFormat[t.format].found++; byKey[t.key].found++;
        statusTotal++;
        if (g!.status === t.status) { statusRight++; byFormat[t.format].correct++; }
        else if (process.env.MISMATCH && mismatches.length < 30) mismatches.push(`${r.id} ${t.key} ${t.format} truth ${t.value} ${t.status} got ${g!.value} ${g!.status} [${g!.referenceRange}]`);
      }
      const isAbn = t.status !== 'normal';
      const flagged = Boolean(valueOk && g!.status !== 'normal');
      if (isAbn && flagged) abn.tp++; else if (isAbn) abn.fn++; else if (flagged) abn.fp++; else abn.tn++;
    }
    for (const g of ex.values) if (!truthKeys.has(g.key)) { extra++; if (g.status !== 'normal') abn.fp++; }
  }
  const total = Object.values(byFormat).reduce((a, b) => a + b.total, 0);
  const found = Object.values(byFormat).reduce((a, b) => a + b.found, 0);
  const P = abn.tp / (abn.tp + abn.fp), R = abn.tp / (abn.tp + abn.fn);
  return {
    valueRecall: found / total, valuePrecision: found / (found + extra), extraValues: extra, total,
    statusAccuracy: statusRight / statusTotal,
    abnormal: { ...abn, precision: P, recall: R, f1: (2 * P * R) / (P + R), specificity: abn.tn / (abn.tn + abn.fp) },
    byFormat, byKey
  };
}

// ---------- drug interactions ----------
function drugRun() {
  const r = rng(7);
  const byName = new Map(DRUGS.map((d) => [d.name.toLowerCase(), d]));
  const members = (sel: string) => (sel.startsWith('class:') ? DRUGS.filter((d) => d.classes.includes(sel.slice(6))) : [byName.get(sel)].filter(Boolean)) as typeof DRUGS;
  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const interacting = new Set<string>();
  for (const rule of INTERACTIONS) for (const a of members(rule.a)) for (const b of members(rule.b)) if (a.name !== b.name) interacting.add(pairKey(a.name, b.name));
  const DUP = ['nsaid', 'ssri', 'statin', 'ppi', 'benzodiazepine', 'ace_inhibitor', 'arb', 'beta_blocker', 'anticoagulant', 'opioid', 'antihistamine'];
  const expected = (a: typeof DRUGS[0], b: typeof DRUGS[0]) => interacting.has(pairKey(a.name, b.name)) || DUP.some((c) => a.classes.includes(c) && b.classes.includes(c));
  const forms = (d: typeof DRUGS[0]) => d.aliases[Math.floor(r() * d.aliases.length)];
  let tp = 0, fp = 0, fn = 0, tn = 0, recognised = 0, mentions = 0;
  const pos: [typeof DRUGS[0], typeof DRUGS[0]][] = [], neg: [typeof DRUGS[0], typeof DRUGS[0]][] = [];
  for (let i = 0; i < DRUGS.length; i++) for (let j = i + 1; j < DRUGS.length; j++) (expected(DRUGS[i], DRUGS[j]) ? pos : neg).push([DRUGS[i], DRUGS[j]]);
  const sample = [...pos, ...neg.sort(() => r() - 0.5).slice(0, pos.length)];
  for (const [a, b] of sample) {
    // written the way a prescription line looks, using brand or generic names
    const text = `Rx: Tab ${forms(a)} 500 mg BD x 5 days; Tab ${forms(b)} 75 mg OD`;
    const res = checkInteractions(text.split(/;|Rx:/).map((s) => s.replace(/\b(tab|cap|syp|inj)\.?\b/gi, '').replace(/\d+\s*mg.*$/i, '').trim()).filter(Boolean));
    mentions += 2; recognised += res.recognised.length;
    const alert = res.alerts.length > 0, want = expected(a, b);
    if (want && alert) tp++; else if (want) fn++; else if (alert) fp++; else tn++;
  }
  const P = tp / (tp + fp), R = tp / (tp + fn);
  return { drugs: DRUGS.length, rules: INTERACTIONS.length, pairsTested: sample.length, positives: pos.length, tp, fp, fn, tn, precision: P, recall: R, f1: (2 * P * R) / (P + R), specificity: tn / (tn + fp), nameRecognition: recognised / mentions };
}

const deidNo = deidRun(false), deidYes = deidRun(true);
const exOrig = extractionRun((r) => r.text);
const exDeid = extractionRun((r) => deidentify(r.text, [r.patientName]).text);
const drug = drugRun();
if (mismatches.length) console.log(mismatches.join('\n'));
const result = { reports: N, seed: SEED, hard: HARD, deidentification: { withoutRegisteredName: deidNo, withRegisteredName: deidYes }, extraction: { original: exOrig, afterDeidentification: exDeid }, drug };
fs.writeFileSync(path.join(OUT, `${TAG}.json`), JSON.stringify(result, null, 1));
const pct = (x: number) => (100 * x).toFixed(1) + '%';
console.log('De-id recall (no name / with name):', pct(deidNo.recall), pct(deidYes.recall), 'reports fully clean:', pct(deidNo.reportsFullyClean), pct(deidYes.reportsFullyClean), 'ms/report', deidYes.msPerReport.toFixed(2));
for (const [k, v] of Object.entries(deidYes.byType)) console.log('  ', k, pct(v.removed / v.total), `(${v.total})`, 'no-name:', pct(deidNo.byType[k].removed / deidNo.byType[k].total));
console.log('  by group (with / without name)', JSON.stringify(deidYes.byGroup), JSON.stringify(deidNo.byGroup));
if (process.env.MISSES) console.log('  misses (no name):', deidNo.misses.join(' | '));
console.log('  by context', JSON.stringify(deidYes.byCtx), JSON.stringify(deidNo.byCtx));
console.log('Extraction value recall/precision', pct(exOrig.valueRecall), pct(exOrig.valuePrecision), 'status acc', pct(exOrig.statusAccuracy), 'abn P/R/F1', pct(exOrig.abnormal.precision), pct(exOrig.abnormal.recall), pct(exOrig.abnormal.f1), 'spec', pct(exOrig.abnormal.specificity));
console.log('  after deid: recall', pct(exDeid.valueRecall), 'F1', pct(exDeid.abnormal.f1));
for (const [k, v] of Object.entries(exOrig.byFormat)) console.log('  format', k, pct(v.found / v.total), `(${v.total})`);
const weak = Object.entries(exOrig.byKey).filter(([, v]) => v.found / v.total < 0.95).map(([k, v]) => `${k} ${pct(v.found / v.total)}`);
console.log('  weak tests:', weak.join(', '));
console.log('Drug:', JSON.stringify(drug));
