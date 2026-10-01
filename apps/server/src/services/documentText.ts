import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

/**
 * Reads the text inside uploaded medical documents (Project Guide §6.1 "Text extraction").
 *
 *  - PDF with a text layer  → text read directly with pdf.js (fast, exact)
 *  - scanned PDF pages      → each page without text is rendered to an image and OCR'd with Tesseract
 *  - photos / scans (PNG, JPEG, WebP) → OCR
 *  - Word (.docx)           → text read with mammoth
 *  - plain text / CSV       → used as is
 *
 * Everything runs on this server; nothing is sent anywhere. English OCR data ships with the app,
 * so it works offline.
 */

export type ExtractionMethod = 'pdf-text' | 'ocr' | 'pdf-text+ocr' | 'docx' | 'plain' | 'unsupported';

export interface ExtractionResult {
  text: string;
  method: ExtractionMethod;
  pages: number;
  ocrPages: number;
  /** average Tesseract confidence (0–100) over OCR'd pages, null when no OCR was needed */
  confidence: number | null;
  /** Numbers OCR read with low confidence (short, value-like only): shown as "check against the report". */
  uncertainNumbers?: string[];
  /** A noisy photo had to be cleaned up before it could be read (its text is less reliable). */
  cleanedPhoto?: boolean;
  language: string;
  durationMs: number;
  warnings: string[];
}

const MAX_CHARS = 200_000;
/** a PDF page with fewer visible characters than this is treated as a scan */
const MIN_PAGE_TEXT = 25;
const RENDER_SCALE = 2.5; // ~180 dpi for an A4 page — a good balance of OCR accuracy and speed

// ---------------------------------------------------------------------------
// Text clean-up
// ---------------------------------------------------------------------------

/** General clean-up for any extracted text. */
export const normaliseText = (raw: string): string =>
  raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    // "haemo-\nglobin" → "haemoglobin"
    .replace(/([a-z])-\n([a-z])/g, '$1$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_CHARS);

/** Fixes the OCR mistakes that matter most in lab reports (units read with I/l/1/| instead of L). */
export const fixOcrText = (raw: string): string =>
  raw
    // stray table rules and scanner noise between words: "Hemoglobin ~~ 9.8"
    .replace(/(^|\s)[~_|]{1,4}(?=\s)/gm, '$1')
    // "mlU/L" / "1U/L" → "mIU/L" / "IU/L"
    .replace(/(?<![A-Za-z])m[lI1|]U(?=\/)/g, 'mIU')
    .replace(/(?<=[\d\s])[l1|]U(?=\/)/g, 'IU')
    .replace(/\b(m?g|mmol|µmol|umol|IU|U|mEq|ng|pg|µg|ug)\/d[Il1|]\b/g, '$1/dL')
    .replace(/\b(mIU|IU|U|mmol|µmol|umol|mEq|ng|pg|mg)\/[Il1|]\b/g, '$1/L')
    .replace(/\bm[Il1|]\/m[Il1|]n\b/g, 'mL/min')
    .replace(/\bmm\s?Hg\b/gi, 'mmHg')
    // "13,5 g/dL" read with a comma as decimal point before a unit
    .replace(/(\d),(\d)(?=\s*(?:g\/dL|mg\/dL|mmol\/L|%))/g, '$1.$2')
    // letter O inside numbers: "1O.2" → "10.2"
    .replace(/(?<=\d)[Oo](?=[\d.])|(?<=\d\.)[Oo]\b/g, '0')
    // stray marks between a value and its unit: "9.8¢g/dL", "142 • mg/dL"
    .replace(/(\d)\s*[¢©®•·¤§]+\s*(?=[A-Za-zµ%])/g, '$1 ')
    // value glued to its unit: "6.8mIU/L" → "6.8 mIU/L"
    .replace(/(\d)(?=(?:mg|g\/|mIU|IU\/|mmol|mEq|ng\/|pg\/|µg|ug\/|lakh|cells)\b|(?:mg|mIU|mmol|mEq)\/)/g, '$1 ')
    .replace(/[ \t]{2,}/g, ' ');

// ---------------------------------------------------------------------------
// OCR engine (one Tesseract worker, created on first use and reused)
// ---------------------------------------------------------------------------

type OcrWord = { text: string; confidence: number };
type TesseractWorker = {
  recognize: (
    image: Buffer,
    options?: Record<string, unknown>,
    output?: Record<string, boolean>
  ) => Promise<{ data: { text: string; confidence: number; blocks?: Array<{ paragraphs: Array<{ lines: Array<{ words: OcrWord[] }> }> }> | null } }>;
  terminate: () => Promise<unknown>;
};

/** A number Tesseract read with less than this word confidence is listed as "check against the report". */
export const UNCERTAIN_WORD_CONFIDENCE = 90;

/**
 * Numbers read with low confidence, as they appear in the text ("88", "0.16"). Only short
 * value-like numbers are kept: long digit runs are identifiers, not results, and are never stored.
 * In the evaluation, 7 of 9 misread lab numbers on poor photos had word confidence below 90.
 */
export const uncertainNumbers = (words: OcrWord[]): string[] => {
  const out = new Set<string>();
  for (const w of words) {
    if (w.confidence >= UNCERTAIN_WORD_CONFIDENCE) continue;
    for (const n of (w.text || '').match(/\d+(?:[.,]\d+)?/g) || []) {
      if (n.replace(/\D/g, '').length <= 6) out.add(n);
    }
  }
  return [...out].slice(0, 200);
};

/**
 * A small pool of Tesseract workers (config.ocrWorkers, default 2) so two documents or pages can be
 * read at once. Each worker is created on first use and all are freed after a quiet minute.
 */
type Slot = { worker: Promise<TesseractWorker> | null; busy: boolean };
const slots: Slot[] = [];
const waiting: Array<(slot: Slot) => void> = [];
let idleTimer: NodeJS.Timeout | null = null;

/** English data comes from the @tesseract.js-data/eng package so OCR works offline. */
const bundledEnglishPath = (): string | null => {
  try {
    const pkg = require.resolve('@tesseract.js-data/eng/package.json');
    const dir = path.join(path.dirname(pkg), '4.0.0_best_int');
    return fs.existsSync(path.join(dir, 'eng.traineddata.gz')) ? dir : null;
  } catch {
    return null;
  }
};

const createTesseract = async (): Promise<TesseractWorker> => {
  const { createWorker } = await import('tesseract.js');
  const langs = config.ocrLanguages;
  const langPath = config.ocrLangPath || (langs === 'eng' ? bundledEnglishPath() : null);
  const options: Record<string, unknown> = {
    gzip: true,
    // without this, a worker error is thrown outside any promise and would crash the server
    errorHandler: (err: unknown) => console.warn('[OCR] worker error:', (err as Error)?.message || err)
  };
  if (langPath) {
    options.langPath = langPath;
    options.cacheMethod = 'none';
  } else {
    // other languages are downloaded once, then cached next to the data folder
    fs.mkdirSync(config.ocrCacheDir, { recursive: true });
    options.cachePath = config.ocrCacheDir;
  }
  return (await createWorker(langs, 1, options)) as unknown as TesseractWorker;
};

/** Borrows a free worker (waiting if all are busy). */
const acquire = async (): Promise<{ slot: Slot; worker: TesseractWorker }> => {
  if (idleTimer) clearTimeout(idleTimer);
  while (slots.length < Math.max(1, config.ocrWorkers)) slots.push({ worker: null, busy: false });
  let slot = slots.find((s) => !s.busy);
  if (!slot) slot = await new Promise<Slot>((resolve) => waiting.push(resolve));
  slot.busy = true;
  try {
    let pending = slot.worker;
    if (!pending) {
      const s = slot;
      pending = s.worker = createTesseract().catch((err) => {
        s.worker = null;
        throw err;
      });
    }
    return { slot, worker: await pending };
  } catch (err) {
    release(slot);
    throw err;
  }
};

const release = (slot: Slot): void => {
  const next = waiting.shift();
  if (next) next(slot);
  else {
    slot.busy = false;
    if (slots.every((s) => !s.busy)) scheduleIdleShutdown();
  }
};

/** Replaces a worker that crashed or got stuck. */
const discard = async (slot: Slot): Promise<void> => {
  const w = slot.worker;
  slot.worker = null;
  if (w) await (await w.catch(() => null))?.terminate().catch(() => undefined);
};

/** Frees the OCR workers' memory after a quiet minute. */
const scheduleIdleShutdown = (): void => {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => void shutdownOcr(), 60_000);
  idleTimer.unref();
};

export const shutdownOcr = async (): Promise<void> => {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  // busy workers finish their page first; they are freed at the next idle shutdown
  await Promise.all(slots.filter((s) => !s.busy).map((s) => discard(s)));
};

const withTimeout = <T>(promise: Promise<T>, ms: number, what: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} took longer than ${Math.round(ms / 1000)} s`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });

const recognise = async (image: Buffer): Promise<{ text: string; confidence: number; uncertain: string[] }> => {
  const { slot, worker } = await acquire();
  try {
    const { data } = await withTimeout(worker.recognize(image, {}, { text: true, blocks: true }), config.ocrPageTimeoutMs, 'OCR');
    const words = (data.blocks || []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)));
    return { text: data.text || '', confidence: Math.round(data.confidence || 0), uncertain: uncertainNumbers(words) };
  } catch (err) {
    const message = String((err as Error)?.message || err);
    if (/attempting to read image/i.test(message)) {
      throw new Error('The image could not be opened — the file may be damaged.');
    }
    // a stuck or crashed worker is replaced for the next page
    await discard(slot);
    throw err instanceof Error ? err : new Error(message);
  } finally {
    release(slot);
  }
};

/** Pixels decoded for clean-up at most (a 12-megapixel phone photo is ~12 M); larger images are refused. */
const MAX_CLEANUP_PIXELS = 40_000_000;

/**
 * Sensor-noise estimate (standard deviation, grey levels) by Immerkær's method: the image is
 * filtered with a Laplacian-difference mask that cancels smooth content, so what is left is
 * noise. After JPEG compression (which smooths it) the evaluation images measure about 0.3 for a
 * clean scan, 1.2 for a careful phone photo and 2.1 for a poor one.
 */
export const estimateNoise = (gray: Uint8Array, w: number, h: number): number => {
  if (w < 3 || h < 3) return 0;
  let sum = 0;
  let n = 0;
  // every 2nd row is enough and keeps this fast on 12-megapixel photos
  for (let y = 1; y < h - 1; y += 2) {
    const r0 = (y - 1) * w, r1 = y * w, r2 = (y + 1) * w;
    for (let x = 1; x < w - 1; x++) {
      const v =
        gray[r0 + x - 1] - 2 * gray[r0 + x] + gray[r0 + x + 1] -
        2 * gray[r1 + x - 1] + 4 * gray[r1 + x] - 2 * gray[r1 + x + 1] +
        gray[r2 + x - 1] - 2 * gray[r2 + x] + gray[r2 + x + 1];
      sum += v < 0 ? -v : v;
      n++;
    }
  }
  return n ? (Math.sqrt(Math.PI / 2) * sum) / (6 * n) : 0;
};

/**
 * Clean-up for phone photos (measured on the evaluation's development set, see docs/evaluation):
 *  1. grey scale, following the photo's EXIF orientation;
 *  2. resize to about A4 at 300 dpi (Tesseract reads small, blurred strokes badly, and large
 *     12-megapixel photos only cost time);
 *  3. 3×3 median, then a light Gaussian blur — removes sensor noise and JPEG blocks;
 *  4. divide by a smooth background (the page shrunk 8×, dilated to drop the text, blurred and
 *     scaled back) — removes uneven lighting.
 * The result stays grey: Tesseract thresholds it well once noise and lighting are gone, and a
 * hard black-and-white threshold here was measured to lose thin strokes of digits.
 */
export const cleanPhotoForOcr = async (image: Buffer): Promise<Buffer> => {
  const sharp = (await import('sharp')).default;
  const input = () => sharp(image, { limitInputPixels: MAX_CLEANUP_PIXELS, failOn: 'error' });
  const meta = await input().metadata();
  const width = meta.autoOrient?.width || meta.width || 0;
  if (!width) throw new Error('The image could not be opened.');
  // small photos are enlarged, very large ones reduced: both to about A4 at 300 dpi
  const scale = Math.min(2, 2480 / width);
  const { data, info } = await input()
    .rotate()
    .grayscale()
    .resize({ width: Math.round(width * scale), kernel: 'cubic' })
    .median(3)
    .blur(1.5)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const sw = Math.max(8, Math.round(w / 8)), sh = Math.max(8, Math.round(h / 8));
  const bg = await sharp(
    await sharp(data, { raw: { width: w, height: h, channels: 1 } }).resize(sw, sh, { kernel: 'linear' }).dilate(3).blur(2).raw().toBuffer(),
    { raw: { width: sw, height: sh, channels: 1 } }
  )
    .resize(w, h, { kernel: 'linear' })
    .raw()
    .toBuffer();
  const out = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    const v = (data[i] / Math.max(1, bg[i])) * 255;
    out[i] = v > 255 ? 255 : v;
  }
  return sharp(out, { raw: { width: w, height: h, channels: 1 } }).png({ compressionLevel: 0 }).toBuffer();
};

/** Noise level from which a photo is cleaned up before the first reading (saves a failed pass). */
const NOISY = 1.6;
/** Below this confidence the page is read again the other way, and the better reading is kept. */
const RETRY_BELOW = 60;

/** Grey pixels of an image, for the noise estimate (null when it cannot be decoded here). */
const greyPixels = async (image: Buffer): Promise<{ gray: Uint8Array; w: number; h: number } | null> => {
  try {
    const sharp = (await import('sharp')).default;
    const { data, info } = await sharp(image, { limitInputPixels: MAX_CLEANUP_PIXELS, failOn: 'error' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { gray: data, w: info.width, h: info.height };
  } catch {
    return null;
  }
};

/** Photos wider than this are reduced before reading: more pixels only cost time. */
const MAX_OCR_WIDTH = 3500;

/** A very large photo reduced to about A4 at 300 dpi (other images are returned unchanged). */
const capSize = async (image: Buffer, width?: number): Promise<Buffer> => {
  if (!width || width <= MAX_OCR_WIDTH) return image;
  try {
    const sharp = (await import('sharp')).default;
    return await sharp(image, { limitInputPixels: MAX_CLEANUP_PIXELS, failOn: 'error' }).rotate().grayscale().resize({ width: 2480 }).png({ compressionLevel: 0 }).toBuffer();
  } catch {
    return image;
  }
};

export const ocrImage = async (image: Buffer): Promise<{ text: string; confidence: number; uncertain: string[]; cleaned?: boolean; noise?: number }> => {
  const px = await greyPixels(image);
  const noise = px ? Math.round(estimateNoise(px.gray, px.w, px.h) * 10) / 10 : undefined;
  const original = image;
  image = await capSize(image, px?.w);
  const clean = async (): Promise<{ text: string; confidence: number; uncertain: string[] } | null> => {
    try {
      return await recognise(await cleanPhotoForOcr(original));
    } catch {
      return null;
    }
  };
  // noisy photo: clean up first; fall back to the original only if that reading is poor
  if (noise !== undefined && noise >= NOISY) {
    const cleaned = await clean();
    if (cleaned && cleaned.confidence >= RETRY_BELOW) return { ...cleaned, cleaned: true, noise };
    const raw = await recognise(image);
    return cleaned && cleaned.confidence > raw.confidence ? { ...cleaned, cleaned: true, noise } : { ...raw, noise };
  }
  const first = await recognise(image);
  if (first.confidence >= RETRY_BELOW || !px) return { ...first, noise };
  const second = await clean();
  return second && second.confidence > first.confidence ? { ...second, cleaned: true, noise } : { ...first, noise };
};

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let pdfjsPromise: Promise<PdfJs> | null = null;
const loadPdfJs = (): Promise<PdfJs> => (pdfjsPromise ||= import('pdfjs-dist/legacy/build/pdf.mjs'));

const pdfjsAsset = (folder: string): string => {
  const pkg = require.resolve('pdfjs-dist/package.json');
  return path.join(path.dirname(pkg), folder) + path.sep;
};

interface TextItemLike {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
}

/** Rebuilds reading order: pdf.js returns text runs; start a new line when the baseline moves. */
const itemsToText = (items: TextItemLike[]): string => {
  let out = '';
  let lastY: number | null = null;
  for (const it of items) {
    if (typeof it.str !== 'string') continue;
    const y = it.transform ? it.transform[5] : null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !out.endsWith('\n')) out += '\n';
    else if (out && !out.endsWith('\n') && !out.endsWith(' ') && it.str && !it.str.startsWith(' ')) out += ' ';
    out += it.str;
    if (it.hasEOL) out += '\n';
    if (y !== null) lastY = y;
  }
  return out;
};

const renderPage = async (page: Awaited<ReturnType<Awaited<ReturnType<PdfJs['getDocument']>['promise']>['getPage']>>): Promise<Buffer> => {
  const { createCanvas } = await import('@napi-rs/canvas');
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // pdf.js and this module share the same @napi-rs/canvas build (keep the versions aligned — mixing two crashes the process)
  await page.render({ canvas, canvasContext: ctx, viewport } as never).promise;
  return canvas.toBuffer('image/png');
};

const extractPdf = async (buffer: Buffer, warnings: string[]) => {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    standardFontDataUrl: pdfjsAsset('standard_fonts'),
    cMapUrl: pdfjsAsset('cmaps'),
    cMapPacked: true,
    verbosity: 0
  }).promise;

  const parts: string[] = [];
  let textPages = 0;
  let ocrPages = 0;
  const confidences: number[] = [];
  const uncertain = new Set<string>();
  let cleanedPhoto = false;
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = itemsToText(content.items as TextItemLike[]);

      if (text.replace(/\s/g, '').length < MIN_PAGE_TEXT && config.ocrEnabled) {
        if (ocrPages >= config.ocrMaxPages) {
          warnings.push(`Only the first ${config.ocrMaxPages} scanned pages were read (OCR_MAX_PAGES).`);
          page.cleanup();
          break;
        }
        try {
          const ocr = await ocrImage(await renderPage(page));
          text = fixOcrText(ocr.text);
          confidences.push(ocr.confidence);
          ocr.uncertain.forEach((u) => uncertain.add(u));
          if (ocr.cleaned) cleanedPhoto = true;
          ocrPages++;
        } catch (err) {
          warnings.push(`Page ${n} could not be read: ${(err as Error).message}`);
        }
      } else if (text.trim()) {
        textPages++;
      }
      if (text.trim()) parts.push(doc.numPages > 1 ? `--- Page ${n} ---\n${text}` : text);
      page.cleanup();
    }
    return {
      text: parts.join('\n\n'),
      pages: doc.numPages,
      textPages,
      ocrPages,
      confidence: confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : null,
      uncertainNumbers: [...uncertain],
      cleanedPhoto
    };
  } finally {
    await doc.destroy();
  }
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export const extractDocumentText = async (buffer: Buffer, mime: string): Promise<ExtractionResult> => {
  const started = Date.now();
  const warnings: string[] = [];
  const type = (mime || '').toLowerCase();
  const done = (partial: Omit<ExtractionResult, 'durationMs' | 'warnings' | 'language'>): ExtractionResult => ({
    ...partial,
    text: normaliseText(partial.text),
    language: config.ocrLanguages,
    durationMs: Date.now() - started,
    warnings
  });

  if (type.startsWith('application/pdf')) {
    const r = await extractPdf(buffer, warnings);
    const method: ExtractionMethod = r.ocrPages && r.textPages ? 'pdf-text+ocr' : r.ocrPages ? 'ocr' : 'pdf-text';
    if (!r.text.trim() && !config.ocrEnabled) warnings.push('This PDF has no text layer and OCR is turned off (OCR_ENABLED=false).');
    return done({ text: r.text, method, pages: r.pages, ocrPages: r.ocrPages, confidence: r.confidence, uncertainNumbers: r.uncertainNumbers.length ? r.uncertainNumbers : undefined, cleanedPhoto: r.cleanedPhoto || undefined });
  }

  if (type.startsWith('image/')) {
    if (!config.ocrEnabled) {
      warnings.push('OCR is turned off (OCR_ENABLED=false).');
      return done({ text: '', method: 'unsupported', pages: 1, ocrPages: 0, confidence: null });
    }
    // Images are decoded inside Tesseract's WebAssembly sandbox (PNG, JPEG, WebP), so a damaged
    // file only produces an error. (Native image decoders can crash the process on bad input.)
    const ocr = await ocrImage(buffer);
    return done({ text: fixOcrText(ocr.text), method: 'ocr', pages: 1, ocrPages: 1, confidence: ocr.confidence, uncertainNumbers: ocr.uncertain.length ? ocr.uncertain : undefined, cleanedPhoto: ocr.cleaned || undefined });
  }

  if (type.includes('wordprocessingml')) {
    const mammoth = await import('mammoth');
    const r = await mammoth.extractRawText({ buffer });
    return done({ text: r.value, method: 'docx', pages: 1, ocrPages: 0, confidence: null });
  }

  if (type.startsWith('text/')) {
    return done({ text: buffer.toString('utf8'), method: 'plain', pages: 1, ocrPages: 0, confidence: null });
  }

  warnings.push('Text cannot be read from this file type (DICOM images and spreadsheets are stored but not read).');
  return done({ text: '', method: 'unsupported', pages: 0, ocrPages: 0, confidence: null });
};
