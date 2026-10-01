/**
 * Phase 11 – builds the pack two doctors rate: 30 AI summaries of real (anonymised) reports, each beside
 * its original, plus a blank rating sheet. From apps/server:
 *     node --import tsx ../../docs/study/make_review_pack.ts
 * Options: STUDY_DIR (default docs/study/data), REVIEW_N (default 30), REVIEW_SEED (default 11).
 * Writes docs/study/results/review_pack.html and docs/study/results/clinician_ratings_blank.csv.
 * The summaries come from the built-in engine only (no external AI), exactly as a patient would see them.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.NODE_ENV ||= 'test';
process.env.OPENAI_API_KEY = '';
process.env.JWT_SECRET ||= 'review-pack-secret-that-is-longer-than-32-characters';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(process.env.STUDY_DIR || path.join(here, 'data'));
const OUT = path.join(here, 'results');
const N = Number(process.env.REVIEW_N || 30);
const MIME: Record<string, string> = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// small seeded shuffle so the same pack can be rebuilt
function shuffled<T>(xs: T[], seed: number): T[] {
  let a = seed >>> 0;
  const r = () => ((a = (a + 0x6d2b79f5) >>> 0), ((((a ^ (a >>> 15)) * (1 | a)) >>> 0) % 1e9) / 1e9);
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

(async () => {
  const { extractDocumentText } = await import('../../apps/server/src/services/documentText.js');
  const { markUncertain } = await import('../../apps/server/src/services/recordText.js');
  const { aiService } = await import('../../apps/server/src/services/aiService.js');
  const files = fs.readdirSync(path.join(DIR, 'reports')).filter((f) => MIME[path.extname(f).toLowerCase()]).sort();
  if (!files.length) throw new Error(`No reports in ${path.join(DIR, 'reports')}`);
  const picked = shuffled(files, Number(process.env.REVIEW_SEED || 11)).slice(0, N);

  const cards: string[] = [];
  const csv = ['summary_id,file,rater,accuracy_1to5,usefulness_1to5,harmful_yes_no,harm_description,comment'];
  for (const [i, file] of picked.entries()) {
    const id = `S${String(i + 1).padStart(2, '0')}`;
    const buf = fs.readFileSync(path.join(DIR, 'reports', file));
    const mime = MIME[path.extname(file).toLowerCase()];
    const ext = await extractDocumentText(buf, mime);
    const s = await aiService.summarizeReport(markUncertain(ext.text, ext.uncertainNumbers));
    const original = mime.startsWith('image/')
      ? `<img src="data:${mime};base64,${buf.toString('base64')}" alt="Original report ${id}">`
      : `<p class="note">PDF – use the printed original for ${esc(file)}. Text read from it:</p><pre>${esc(ext.text.slice(0, 4000))}</pre>`;
    const abnormal = s.abnormalValues.map((a) => `<li>${esc(`${a.test}: ${a.value} – ${a.status} (range ${a.referenceRange})${a.uncertain ? ' – check against the report' : ''}`)}</li>`).join('');
    cards.push(`<section class="card"><h2>${id} <small>${esc(file)}</small></h2><div class="cols"><div class="orig">${original}</div><div class="ai">
      <h3>What the patient sees</h3><p>${esc(s.summary)}</p>
      ${s.keyFindings.length ? `<h4>Key findings</h4><ul>${s.keyFindings.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
      ${abnormal ? `<h4>Values outside the range</h4><ul>${abnormal}</ul>` : ''}
      ${s.questionsForDoctor.length ? `<h4>Questions for the doctor</h4><ul>${s.questionsForDoctor.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
      <table class="rate"><tr><th></th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr>
      <tr><td>Accuracy (1 = many errors, 5 = fully correct)</td><td>☐</td><td>☐</td><td>☐</td><td>☐</td><td>☐</td></tr>
      <tr><td>Usefulness to the patient (1 = none, 5 = very)</td><td>☐</td><td>☐</td><td>☐</td><td>☐</td><td>☐</td></tr></table>
      <p>Could anything here lead a patient to harm (e.g. a missed dangerous value, wrong reassurance)? ☐ No ☐ Yes – what: ______________________</p>
    </div></div></section>`);
    for (const rater of ['A', 'B']) csv.push(`${id},${file},${rater},,,,,`);
    process.stderr.write(`${id} ${file}\n`);
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>MedLedger AI – clinician review pack</title><style>
    body{font:13px/1.45 system-ui,sans-serif;margin:24px;color:#0b1220} h1{font-size:20px} .card{border:1px solid #cbd5e1;border-radius:8px;padding:12px;margin:0 0 18px;page-break-inside:avoid}
    .cols{display:grid;grid-template-columns:1fr 1fr;gap:14px} img{max-width:100%;border:1px solid #e2e8f0} pre{white-space:pre-wrap;font-size:11px;background:#f8fafc;padding:8px}
    .rate{border-collapse:collapse;margin:8px 0} .rate td,.rate th{border:1px solid #cbd5e1;padding:3px 7px;text-align:center} .rate td:first-child{text-align:left}
    small{color:#475569;font-weight:normal} .note{color:#475569} @media print{.card{break-inside:avoid}}</style></head><body>
    <h1>MedLedger AI – clinician review of ${picked.length} AI summaries</h1>
    <p>Each summary was produced by the built-in engine from the report on its left. Please rate each one on your own, without discussing it with the other reviewer, and enter your ratings in <b>clinician_ratings.csv</b> (rater A or B). A "harmful" error is anything that could lead a patient to delay care, take a wrong action or be falsely reassured.</p>
    ${cards.join('\n')}</body></html>`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'review_pack.html'), html);
  fs.writeFileSync(path.join(OUT, 'clinician_ratings_blank.csv'), csv.join('\n') + '\n');
  console.log(`review pack with ${picked.length} summaries: ${path.relative(process.cwd(), path.join(OUT, 'review_pack.html'))}`);
  process.exit(0);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
