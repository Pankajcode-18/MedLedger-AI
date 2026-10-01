"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDocumentText = exports.ocrImage = exports.shutdownOcr = exports.fixOcrText = exports.normaliseText = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("../config/index.js");
const MAX_CHARS = 200_000;
/** a PDF page with fewer visible characters than this is treated as a scan */
const MIN_PAGE_TEXT = 25;
const RENDER_SCALE = 2.5; // ~180 dpi for an A4 page — a good balance of OCR accuracy and speed
// ---------------------------------------------------------------------------
// Text clean-up
// ---------------------------------------------------------------------------
/** General clean-up for any extracted text. */
const normaliseText = (raw) => raw
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
exports.normaliseText = normaliseText;
/** Fixes the OCR mistakes that matter most in lab reports (units read with I/l/1/| instead of L). */
const fixOcrText = (raw) => raw
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
exports.fixOcrText = fixOcrText;
let workerPromise = null;
let idleTimer = null;
/** English data comes from the @tesseract.js-data/eng package so OCR works offline. */
const bundledEnglishPath = () => {
    try {
        const pkg = require.resolve('@tesseract.js-data/eng/package.json');
        const dir = path_1.default.join(path_1.default.dirname(pkg), '4.0.0_best_int');
        return fs_1.default.existsSync(path_1.default.join(dir, 'eng.traineddata.gz')) ? dir : null;
    }
    catch {
        return null;
    }
};
const getWorker = async () => {
    if (idleTimer)
        clearTimeout(idleTimer);
    if (!workerPromise) {
        workerPromise = (async () => {
            const { createWorker } = await import('tesseract.js');
            const langs = index_js_1.config.ocrLanguages;
            const langPath = index_js_1.config.ocrLangPath || (langs === 'eng' ? bundledEnglishPath() : null);
            const options = {
                gzip: true,
                // without this, a worker error is thrown outside any promise and would crash the server
                errorHandler: (err) => console.warn('[OCR] worker error:', err?.message || err)
            };
            if (langPath) {
                options.langPath = langPath;
                options.cacheMethod = 'none';
            }
            else {
                // other languages are downloaded once, then cached next to the data folder
                fs_1.default.mkdirSync(index_js_1.config.ocrCacheDir, { recursive: true });
                options.cachePath = index_js_1.config.ocrCacheDir;
            }
            return (await createWorker(langs, 1, options));
        })().catch((err) => {
            workerPromise = null;
            throw err;
        });
    }
    return workerPromise;
};
/** Frees the OCR worker's memory after a quiet minute. */
const scheduleIdleShutdown = () => {
    if (idleTimer)
        clearTimeout(idleTimer);
    idleTimer = setTimeout(() => void (0, exports.shutdownOcr)(), 60_000);
    idleTimer.unref();
};
const shutdownOcr = async () => {
    if (idleTimer)
        clearTimeout(idleTimer);
    idleTimer = null;
    const p = workerPromise;
    workerPromise = null;
    if (p)
        await (await p.catch(() => null))?.terminate().catch(() => undefined);
};
exports.shutdownOcr = shutdownOcr;
const withTimeout = (promise, ms, what) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} took longer than ${Math.round(ms / 1000)} s`)), ms);
    promise.then((v) => {
        clearTimeout(t);
        resolve(v);
    }, (e) => {
        clearTimeout(t);
        reject(e);
    });
});
const ocrImage = async (image) => {
    const worker = await getWorker();
    try {
        const { data } = await withTimeout(worker.recognize(image), index_js_1.config.ocrPageTimeoutMs, 'OCR');
        return { text: data.text || '', confidence: Math.round(data.confidence || 0) };
    }
    catch (err) {
        const message = String(err?.message || err);
        if (/attempting to read image/i.test(message)) {
            throw new Error('The image could not be opened — the file may be damaged.');
        }
        // a stuck or crashed worker is replaced for the next page
        await (0, exports.shutdownOcr)();
        throw err instanceof Error ? err : new Error(message);
    }
    finally {
        scheduleIdleShutdown();
    }
};
exports.ocrImage = ocrImage;
let pdfjsPromise = null;
const loadPdfJs = () => (pdfjsPromise ||= import('pdfjs-dist/legacy/build/pdf.mjs'));
const pdfjsAsset = (folder) => {
    const pkg = require.resolve('pdfjs-dist/package.json');
    return path_1.default.join(path_1.default.dirname(pkg), folder) + path_1.default.sep;
};
/** Rebuilds reading order: pdf.js returns text runs; start a new line when the baseline moves. */
const itemsToText = (items) => {
    let out = '';
    let lastY = null;
    for (const it of items) {
        if (typeof it.str !== 'string')
            continue;
        const y = it.transform ? it.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !out.endsWith('\n'))
            out += '\n';
        else if (out && !out.endsWith('\n') && !out.endsWith(' ') && it.str && !it.str.startsWith(' '))
            out += ' ';
        out += it.str;
        if (it.hasEOL)
            out += '\n';
        if (y !== null)
            lastY = y;
    }
    return out;
};
const renderPage = async (page) => {
    const { createCanvas } = await import('@napi-rs/canvas');
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // pdf.js and this module share the same @napi-rs/canvas build (keep the versions aligned — mixing two crashes the process)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return canvas.toBuffer('image/png');
};
const extractPdf = async (buffer, warnings) => {
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
    const parts = [];
    let textPages = 0;
    let ocrPages = 0;
    const confidences = [];
    try {
        for (let n = 1; n <= doc.numPages; n++) {
            const page = await doc.getPage(n);
            const content = await page.getTextContent();
            let text = itemsToText(content.items);
            if (text.replace(/\s/g, '').length < MIN_PAGE_TEXT && index_js_1.config.ocrEnabled) {
                if (ocrPages >= index_js_1.config.ocrMaxPages) {
                    warnings.push(`Only the first ${index_js_1.config.ocrMaxPages} scanned pages were read (OCR_MAX_PAGES).`);
                    page.cleanup();
                    break;
                }
                try {
                    const ocr = await (0, exports.ocrImage)(await renderPage(page));
                    text = (0, exports.fixOcrText)(ocr.text);
                    confidences.push(ocr.confidence);
                    ocrPages++;
                }
                catch (err) {
                    warnings.push(`Page ${n} could not be read: ${err.message}`);
                }
            }
            else if (text.trim()) {
                textPages++;
            }
            if (text.trim())
                parts.push(doc.numPages > 1 ? `--- Page ${n} ---\n${text}` : text);
            page.cleanup();
        }
        return {
            text: parts.join('\n\n'),
            pages: doc.numPages,
            textPages,
            ocrPages,
            confidence: confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : null
        };
    }
    finally {
        await doc.destroy();
    }
};
// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const extractDocumentText = async (buffer, mime) => {
    const started = Date.now();
    const warnings = [];
    const type = (mime || '').toLowerCase();
    const done = (partial) => ({
        ...partial,
        text: (0, exports.normaliseText)(partial.text),
        language: index_js_1.config.ocrLanguages,
        durationMs: Date.now() - started,
        warnings
    });
    if (type.startsWith('application/pdf')) {
        const r = await extractPdf(buffer, warnings);
        const method = r.ocrPages && r.textPages ? 'pdf-text+ocr' : r.ocrPages ? 'ocr' : 'pdf-text';
        if (!r.text.trim() && !index_js_1.config.ocrEnabled)
            warnings.push('This PDF has no text layer and OCR is turned off (OCR_ENABLED=false).');
        return done({ text: r.text, method, pages: r.pages, ocrPages: r.ocrPages, confidence: r.confidence });
    }
    if (type.startsWith('image/')) {
        if (!index_js_1.config.ocrEnabled) {
            warnings.push('OCR is turned off (OCR_ENABLED=false).');
            return done({ text: '', method: 'unsupported', pages: 1, ocrPages: 0, confidence: null });
        }
        // Images are decoded inside Tesseract's WebAssembly sandbox (PNG, JPEG, WebP), so a damaged
        // file only produces an error. (Native image decoders can crash the process on bad input.)
        const ocr = await (0, exports.ocrImage)(buffer);
        return done({ text: (0, exports.fixOcrText)(ocr.text), method: 'ocr', pages: 1, ocrPages: 1, confidence: ocr.confidence });
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
exports.extractDocumentText = extractDocumentText;
