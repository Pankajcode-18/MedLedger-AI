// Writes N synthetic reports (held-out seed) to results/ocr_reports.json for rendering as scans.
import fs from 'fs';
import path from 'path';
import { makeDataset } from './dataset.js';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'results');
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'ocr_reports.json'), JSON.stringify(makeDataset(Number(process.env.N || 60), Number(process.env.OCR_SEED || 515151))));
