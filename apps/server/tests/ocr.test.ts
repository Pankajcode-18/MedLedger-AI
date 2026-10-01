/**
 * Reading uploaded documents (Project Guide §6.1): PDF text layer, OCR of scanned PDFs and
 * photos, Word files — and the full path from upload to the AI summary.
 * Test documents are generated in memory (tests/helpers/documents.ts). Run with: npm test
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { reportImage, scannedPdf, textPdf } from './helpers/documents.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medledger-ocr-'));
process.env.NODE_ENV = 'test';
process.env.STATE_FILE_PATH = path.join(tmpDir, 'state.json');
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';
process.env.AUTH_RATE_LIMIT = '10000';
process.env.AI_RATE_LIMIT_PER_MIN = '10000';
process.env.DEMO_ACCOUNTS = 'true';
process.env.OPENAI_API_KEY = '';

type Json = Record<string, any>;
let server: Server;
let base = '';
let patient = '';
let doctor = '';
let lab = '';

const CBC = [
  'CITY DIAGNOSTIC LAB - COMPLETE BLOOD COUNT',
  'Hemoglobin        9.8 g/dL     (13.0 - 17.0)   LOW',
  'Fasting Blood Sugar     142 mg/dL    (70 - 99)   HIGH',
  'Platelet Count    2.1 lakh/cumm'
];
const THYROID = ['THYROID PROFILE', 'TSH     6.8 mIU/L    (0.4 - 4.0)   HIGH'];

const tokenFor = async (email: string, password: string): Promise<string> => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return ((await res.json()) as Json).data.token;
};

const upload = async (token: string, fields: Record<string, string>, file: { name: string; bytes: Buffer }) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('file', new Blob([file.bytes]), file.name);
  const res = await fetch(`${base}/api/records/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, body: (await res.json()) as Json };
};

const call = async (method: string, url: string, token: string, body?: unknown) => {
  const res = await fetch(base + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};

const waitForText = async () => {
  const { textExtraction } = await import('../src/services/textExtraction.js');
  await textExtraction.whenIdle();
};

before(async () => {
  const { createApp } = await import('../src/app.js');
  const { userStore } = await import('../src/services/userStore.js');
  await userStore.seedDemoAccounts();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  patient = await tokenFor('patient@medledger.demo', 'secret99');
  doctor = await tokenFor('doctor@medledger.demo', 'secret99');
  lab = await tokenFor('lab@medledger.demo', 'lab123');
});

after(async () => {
  const { shutdownOcr } = await import('../src/services/documentText.js');
  await shutdownOcr();
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('text clean-up', () => {
  test('OCR unit and digit mistakes are corrected', async () => {
    const { fixOcrText, normaliseText } = await import('../src/services/documentText.js');
    assert.equal(fixOcrText('Glucose 142 mg/dI'), 'Glucose 142 mg/dL');
    assert.equal(fixOcrText('Hb 1O.2 g/d1'), 'Hb 10.2 g/dL');
    assert.equal(fixOcrText('TSH 6.8 mIU/l'), 'TSH 6.8 mIU/L');
    assert.equal(fixOcrText('Hemoglobin ~~ 9.8 g/dL'), 'Hemoglobin 9.8 g/dL');
    assert.equal(fixOcrText('Hb 13,5 g/dL'), 'Hb 13.5 g/dL');
    assert.equal(fixOcrText('TSH 6.8mlU/L'), 'TSH 6.8 mIU/L');
    assert.equal(fixOcrText('Hemoglobin 9.8¢g/dL'), 'Hemoglobin 9.8 g/dL');
    // clinical text that must not change
    for (const ok of ['BP 120/80 mmHg', 'SpO2 98%', 'Temp 98.6 °F', 'Tab Metformin 500 mg BD', 'HbA1c 6.1 %']) assert.equal(fixOcrText(ok), ok);
    assert.equal(normaliseText('haemo-\nglobin   12\r\n\n\n\nnext'), 'haemoglobin 12\n\nnext');
  });
});

describe('reading documents', { timeout: 120_000 }, () => {
  test('a digital PDF is read from its text layer, without OCR', async () => {
    const { extractDocumentText } = await import('../src/services/documentText.js');
    const r = await extractDocumentText(textPdf(CBC), 'application/pdf');
    assert.equal(r.method, 'pdf-text');
    assert.equal(r.ocrPages, 0);
    assert.match(r.text, /Hemoglobin 9\.8 g\/dL \(13\.0 - 17\.0\) LOW/);
    assert.match(r.text, /Fasting Blood Sugar 142 mg\/dL/);
  });

  test('a scanned (image-only) PDF is read page by page with OCR', async () => {
    const { extractDocumentText } = await import('../src/services/documentText.js');
    const r = await extractDocumentText(scannedPdf([CBC, THYROID]), 'application/pdf');
    assert.equal(r.method, 'ocr');
    assert.equal(r.pages, 2);
    assert.equal(r.ocrPages, 2);
    assert.ok((r.confidence || 0) > 60, `confidence ${r.confidence}`);
    assert.match(r.text, /Hemoglobin\s+9\.8\s*g\/dL/);
    assert.match(r.text, /142\s*mg\/dL/);
    assert.match(r.text, /--- Page 2 ---[\s\S]*TSH\s+6\.8\s*mIU\/L/);
  });

  test('photos of reports (PNG and JPEG) are read with OCR', async () => {
    const { extractDocumentText } = await import('../src/services/documentText.js');
    for (const format of ['png', 'jpeg'] as const) {
      const r = await extractDocumentText(reportImage(CBC, format), `image/${format}`);
      assert.equal(r.method, 'ocr');
      assert.match(r.text, /Hemoglobin\s+9\.8\s*g\/dL/, `${format}: ${r.text}`);
    }
  });

  test('Word documents are read', async () => {
    const { extractDocumentText } = await import('../src/services/documentText.js');
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${THYROID.map((l) => `<w:p><w:r><w:t xml:space="preserve">${l}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`);
    const docx = await zip.generateAsync({ type: 'nodebuffer' });
    const r = await extractDocumentText(docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.equal(r.method, 'docx');
    assert.match(r.text, /TSH 6\.8 mIU\/L/);
  });
});

describe('from upload to AI', { timeout: 120_000 }, () => {
  let scanId = '';

  test('an uploaded scan is read in the background and its text is encrypted at rest', async () => {
    const up = await upload(patient, {}, { name: 'cbc_scan.pdf', bytes: scannedPdf([CBC]) });
    assert.equal(up.status, 201);
    assert.equal(up.body.data.textExtraction.status, 'pending', 'the upload does not wait for OCR');
    scanId = up.body.data.reportId;

    await waitForText();
    const t = await call('GET', `/api/records/${scanId}/text`, patient);
    assert.equal(t.status, 200);
    assert.equal(t.body.data.extraction.status, 'done');
    assert.equal(t.body.data.extraction.method, 'ocr');
    assert.match(t.body.data.text, /Hemoglobin\s+9\.8\s*g\/dL/);

    await (await import('../src/models/stateStore.js')).stateStore.flush(); // writes are coalesced
    const raw = fs.readFileSync(process.env.STATE_FILE_PATH as string, 'utf8');
    assert.ok(!/Hemoglobin\s+9\.8/.test(raw), 'extracted text must not be stored in plain text');
    assert.match(raw, /"extractedTextSealed": "n1\|/);

    // lists carry the status, not the (possibly long) text
    const list = await call('GET', '/api/records', patient);
    const rec = list.body.data.find((r: Json) => r.reportId === scanId);
    assert.equal(rec.extractedText, undefined);
    assert.equal(rec.textExtraction.status, 'done');
  });

  test('the AI summary now reads the scanned values', async () => {
    const r = await call('POST', '/api/ai/summarize', patient, { reportId: scanId });
    assert.equal(r.status, 200);
    const abnormal = r.body.data.abnormalValues.map((a: Json) => a.test);
    assert.ok(abnormal.includes('Hemoglobin'), JSON.stringify(abnormal));
    assert.ok(abnormal.includes('Fasting Blood Sugar'), JSON.stringify(abnormal));
  });

  test('a lab-uploaded digital PDF is read without OCR and feeds the patient chat', async () => {
    const up = await upload(lab, { patientId: '90' }, { name: 'thyroid.pdf', bytes: textPdf(THYROID) });
    assert.equal(up.status, 201);
    await waitForText();
    const t = await call('GET', `/api/records/${up.body.data.reportId}/text`, patient);
    assert.equal(t.body.data.extraction.method, 'pdf-text');
    const chat = await call('POST', '/api/ai/chat', patient, { messages: [{ role: 'user', content: 'What was my TSH?' }] });
    assert.match(chat.body.data.reply, /6\.8/);
  });

  test('reading the text follows the same permissions as the file', async () => {
    assert.equal((await call('GET', `/api/records/${scanId}/text`, doctor)).status, 403);
    assert.equal((await call('GET', `/api/records/${scanId}/text`, lab)).status, 403);
    assert.equal((await call('POST', `/api/records/${scanId}/extract`, lab)).status, 403);
    const again = await call('POST', `/api/records/${scanId}/extract`, patient);
    assert.equal(again.status, 202);
    await waitForText();
    assert.equal((await call('GET', `/api/records/${scanId}/text`, patient)).body.data.extraction.status, 'done');
  });

  test('a damaged image fails cleanly and never crashes the server', async () => {
    const broken = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300, 7)]);
    const up = await upload(patient, {}, { name: 'broken.png', bytes: broken });
    assert.equal(up.status, 201);
    await waitForText();
    const t = await call('GET', `/api/records/${up.body.data.reportId}/text`, patient);
    assert.equal(t.body.data.extraction.status, 'failed');
    assert.match(t.body.data.extraction.error, /could not be opened/);
    assert.equal((await call('GET', '/api/records', patient)).status, 200, 'server still running');
  });

  test('files that cannot be read are marked, not failed', async () => {
    const dicom = Buffer.concat([Buffer.alloc(128), Buffer.from('DICM'), Buffer.alloc(64)]);
    const up = await upload(patient, {}, { name: 'ct.dcm', bytes: dicom });
    assert.equal(up.status, 201);
    await waitForText();
    const t = await call('GET', `/api/records/${up.body.data.reportId}/text`, patient);
    assert.equal(t.body.data.extraction.status, 'unsupported');
  });

  test('text survives a restart (decrypted when the state file is loaded)', async () => {
    const { stateStore } = await import('../src/models/stateStore.js');
    await (await import('../src/models/stateStore.js')).stateStore.flush(); // writes are coalesced
    const reloaded = stateStore.loadState();
    assert.match(reloaded.reports.find((r) => r.reportId === scanId)?.extractedText || '', /Hemoglobin/);
  });
});

describe('photo clean-up before OCR', () => {
  test('removes noise and uneven lighting, and upscales small photos', async () => {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const { cleanPhotoForOcr, estimateNoise } = await import('../src/services/documentText.js');
    const w = 400, h = 200;
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const isText = (x: number, y: number) => y % 30 >= 12 && y % 30 < 18 && x % 12 < 3; // thin dark strokes stand in for text
    const grey = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = (isText(x, y) ? 40 : 255) * (0.8 + 0.2 * (x / w)) + (rnd() - 0.5) * 50;
      const i = 4 * (y * w + x);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = grey[y * w + x] = Math.max(0, Math.min(255, v));
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    assert.ok(estimateNoise(grey, w, h) > 5, 'the noise is measured');
    const out = await loadImage(await cleanPhotoForOcr(c.toBuffer('image/png')));
    // small photos are enlarged (here 2×) so strokes reach a size Tesseract reads well
    assert.equal(out.width, 2 * w);
    assert.equal(out.height, 2 * h);
    const oc = createCanvas(out.width, out.height);
    oc.getContext('2d').drawImage(out, 0, 0);
    const px = oc.getContext('2d').getImageData(0, 0, out.width, out.height).data;
    // away from stroke edges, the page is white and the strokes are dark, left and right alike
    let wrong = 0, n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const edge = isText(x, y) !== isText(x - 1, y) || isText(x, y) !== isText(x + 1, y) || isText(x, y) !== isText(x, y - 1) || isText(x, y) !== isText(x, y + 1);
      if (edge) continue;
      const v = px[4 * (2 * y * out.width + 2 * x)];
      n++;
      if ((v < 128) !== isText(x, y)) wrong++;
    }
    assert.ok(wrong / n < 0.02, `misclassified ${wrong} of ${n}`);
  });

  test('a clean scan measures almost no noise', async () => {
    const { estimateNoise } = await import('../src/services/documentText.js');
    const w = 200, h = 100;
    const g = new Uint8Array(w * h).fill(250);
    for (let x = 20; x < 180; x++) g[50 * w + x] = 10;
    assert.ok(estimateNoise(g, w, h) < 1);
  });

  test('low-confidence numbers are listed; long digit runs never are', async () => {
    const { uncertainNumbers } = await import('../src/services/documentText.js');
    const u = uncertainNumbers([
      { text: '88', confidence: 70 },
      { text: '9.8', confidence: 97 },
      { text: '0.16', confidence: 85 },
      { text: '9841234567', confidence: 40 }
    ]);
    assert.deepEqual(u, ['88', '0.16']);
  });

  test('uncertain numbers are marked for the AI and reported as "check against the report"', async () => {
    const { markUncertain } = await import('../src/services/recordText.js');
    const { extractClinicalData } = await import('../src/services/ai/clinicalExtractor.js');
    const text = markUncertain('LDL cholesterol: 88 mg/dL\nHemoglobin: 9.8 g/dL\nPlatelets: 188000 /uL', ['88']);
    assert.match(text, /LDL cholesterol: 88\? mg\/dL/);
    assert.ok(!/188000\?/.test(text), 'only whole numbers are marked');
    const ex = extractClinicalData(text);
    assert.equal(ex.values.find((v) => v.key === 'ldl')?.uncertain, true);
    assert.equal(ex.values.find((v) => v.key === 'hemoglobin')?.uncertain, undefined);
  });

  test('impossible readings are ignored (a misread 108 % oxygen)', async () => {
    const { extractClinicalData } = await import('../src/services/ai/clinicalExtractor.js');
    assert.equal(extractClinicalData('Sp02: 108 %').values.find((v) => v.key === 'spo2'), undefined);
    assert.equal(extractClinicalData('Sp02: 94 %').values.find((v) => v.key === 'spo2')?.value, 94);
  });
});
