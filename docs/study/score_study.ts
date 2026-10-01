/**
 * Phase 11 – scores the clinician review and the user study, and checks the "done when" targets.
 * From apps/server:  node --import tsx ../../docs/study/score_study.ts
 * Reads docs/study/data/{clinician_ratings,sus_responses,task_log}.csv (any may be missing) and
 * docs/study/results/real_reports_eval.json if eval_real_reports.ts has run. Writes docs/study/results/study_results.json.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { meanCI, parseCsv, susBand, susScore, weightedKappa, wilson } from './scoring.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(process.env.STUDY_DIR || path.join(here, 'data'));
const RES = path.join(here, 'results');
const read = (f: string) => (fs.existsSync(path.join(DIR, f)) ? parseCsv(fs.readFileSync(path.join(DIR, f), 'utf8')) : null);
const yes = (v: string) => /^(y|yes|true|1|हो|हाँ|छ)$/i.test(v.trim());
type J = Record<string, unknown>;
const out: J = { scoredAt: new Date().toISOString() };

// ---- clinician review
const ratings = read('clinician_ratings.csv')?.filter((r) => r.accuracy_1to5 && r.usefulness_1to5);
if (ratings?.length) {
  const acc = ratings.map((r) => Number(r.accuracy_1to5)), use = ratings.map((r) => Number(r.usefulness_1to5));
  const byId = new Map<string, Record<string, Record<string, string>>>();
  for (const r of ratings) byId.set(r.summary_id, { ...(byId.get(r.summary_id) || {}), [r.rater]: r });
  const both = [...byId.values()].filter((x) => x.A && x.B);
  const harmful = ratings.filter((r) => yes(r.harmful_yes_no || '')).map((r) => ({ summary: r.summary_id, rater: r.rater, what: r.harm_description }));
  out.clinicianReview = {
    summaries: byId.size, ratings: ratings.length,
    accuracy: meanCI(acc), usefulness: meanCI(use),
    accuracyAtLeast4: wilson(acc.filter((x) => x >= 4).length, acc.length),
    agreement: both.length >= 2 ? {
      pairs: both.length,
      accuracyKappa: weightedKappa(both.map((x) => Number(x.A.accuracy_1to5)), both.map((x) => Number(x.B.accuracy_1to5))),
      usefulnessKappa: weightedKappa(both.map((x) => Number(x.A.usefulness_1to5)), both.map((x) => Number(x.B.usefulness_1to5)))
    } : null,
    harmfulErrors: harmful
  };
}

// ---- SUS
const sus = read('sus_responses.csv')?.filter((r) => r.q1);
if (sus?.length) {
  const scored = sus.map((r) => ({ id: r.participant_id, role: r.role, language: r.language, score: susScore(Array.from({ length: 10 }, (_, i) => Number(r[`q${i + 1}`]))) }));
  const group = (key: 'role' | 'language') => Object.fromEntries([...new Set(scored.map((s) => s[key]))].map((g) => [g, meanCI(scored.filter((s) => s[key] === g).map((s) => s.score))]));
  const all = meanCI(scored.map((s) => s.score));
  out.sus = { participants: scored.length, overall: { ...all, band: susBand(all.mean) }, byRole: group('role'), byLanguage: group('language'), scores: scored };
}

// ---- tasks
const tasks = read('task_log.csv')?.filter((r) => r.task);
if (tasks?.length) {
  const names = [...new Set(tasks.map((t) => t.task))];
  out.tasks = Object.fromEntries(names.map((n) => {
    const ts = tasks.filter((t) => t.task === n);
    const done = ts.filter((t) => /^(yes|y)$/i.test(t.completed));
    return [n, {
      attempts: ts.length,
      completedUnaided: wilson(done.length, ts.length),
      completedWithHelp: ts.filter((t) => /^assist/i.test(t.completed)).length,
      seconds: meanCI(done.map((t) => Number(t.seconds)).filter((x) => x > 0)),
      errors: ts.reduce((s, t) => s + (Number(t.errors) || 0), 0)
    }];
  }));
}

// ---- targets (plan: Phase 11 "done when")
const real = fs.existsSync(path.join(RES, 'real_reports_eval.json')) ? JSON.parse(fs.readFileSync(path.join(RES, 'real_reports_eval.json'), 'utf8')) : null;
const printed = real?.byCapture?.printed?.valueRecall?.rate ?? null;
const cr = out.clinicianReview as J | undefined, su = out.sus as J | undefined;
out.targets = {
  valueRecallPrintedAtLeast95: printed == null ? 'no data' : printed >= 0.95,
  noHarmfulErrors: cr ? (cr.harmfulErrors as unknown[]).length === 0 : 'no data',
  meanSusAtLeast70: su ? (su.overall as { mean: number }).mean >= 70 : 'no data'
};
fs.mkdirSync(RES, { recursive: true });
fs.writeFileSync(path.join(RES, 'study_results.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.targets));
if (cr) console.log(`clinicians: accuracy ${(cr.accuracy as J).mean}, usefulness ${(cr.usefulness as J).mean}, harmful ${(cr.harmfulErrors as unknown[]).length}`);
if (su) console.log(`SUS: ${(su.overall as J).mean} (${(su.overall as J).band}), n=${su.participants}`);
