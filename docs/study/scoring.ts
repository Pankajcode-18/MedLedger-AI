/**
 * Phase 11 – scoring for the real-world study. Pure functions, no I/O (tested in apps/server/tests/phase11.test.ts).
 */

/** System Usability Scale (Brooke, 1996): ten answers 1–5 → 0–100. Odd items positive, even items negative. */
export function susScore(answers: number[]): number {
  if (answers.length !== 10) throw new Error(`SUS needs 10 answers, got ${answers.length}`);
  if (answers.some((a) => !Number.isInteger(a) || a < 1 || a > 5)) throw new Error('SUS answers must be whole numbers 1–5');
  const sum = answers.reduce((s, a, i) => s + (i % 2 === 0 ? a - 1 : 5 - a), 0);
  return sum * 2.5;
}

/** Adjective band for a SUS score (Bangor, Kortum & Miller, 2009). */
export const susBand = (score: number): string =>
  score >= 85 ? 'Excellent' : score >= 73 ? 'Good' : score >= 52 ? 'OK' : score >= 39 ? 'Poor' : 'Awful';

export const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

export function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Two-sided t critical values at 95% for small samples (df 1–30); normal value beyond. */
const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];

/** Mean with a 95% confidence interval (t distribution). */
export function meanCI(xs: number[]): { n: number; mean: number; sd: number; low: number; high: number } {
  if (!xs.length) return { n: 0, mean: NaN, sd: NaN, low: NaN, high: NaN };
  const m = mean(xs), s = sd(xs), n = xs.length;
  const t = n >= 2 ? T95[Math.min(n - 2, T95.length - 1)] ?? 1.96 : NaN;
  const half = n >= 2 ? (t * s) / Math.sqrt(n) : NaN;
  return { n, mean: m, sd: s, low: m - half, high: m + half };
}

/**
 * Cohen's kappa with quadratic weights for two raters on an ordinal 1–k scale (agreement on the 1–5 ratings).
 * 1 = perfect agreement, 0 = chance level.
 */
export function weightedKappa(a: number[], b: number[], k = 5): number {
  if (a.length !== b.length || !a.length) throw new Error('Both raters must rate the same items');
  const n = a.length;
  const obs = Array.from({ length: k }, () => new Array(k).fill(0));
  a.forEach((x, i) => (obs[x - 1][b[i] - 1] += 1));
  const ra = obs.map((r) => r.reduce((s, v) => s + v, 0));
  const cb = obs[0].map((_, j) => obs.reduce((s, r) => s + r[j], 0));
  let num = 0, den = 0;
  for (let i = 0; i < k; i++)
    for (let j = 0; j < k; j++) {
      const w = ((i - j) / (k - 1)) ** 2;
      num += w * obs[i][j];
      den += w * ((ra[i] * cb[j]) / n);
    }
  return den === 0 ? 1 : 1 - num / den;
}

/** Wilson 95% interval for a proportion (e.g. value recall on real reports). */
export function wilson(successes: number, total: number): { rate: number; low: number; high: number } {
  if (!total) return { rate: NaN, low: NaN, high: NaN };
  const z = 1.96, p = successes / total;
  const d = 1 + (z * z) / total;
  const c = p + (z * z) / (2 * total);
  const h = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return { rate: p, low: (c - h) / d, high: (c + h) / d };
}

/** Parses a simple CSV (quoted fields allowed) into objects keyed by the header row. Lines starting with # are skipped. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const clean = rows.filter((r) => r.some((c) => c.trim()) && !r[0].trim().startsWith('#'));
  if (!clean.length) return [];
  const head = clean[0].map((h) => h.trim());
  return clean.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
