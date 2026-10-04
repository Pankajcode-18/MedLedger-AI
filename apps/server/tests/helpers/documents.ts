/**
 * Builds small but valid test documents in memory: a PDF with a real text layer, a scanned
 * (image-only) PDF, and report photos — so OCR tests need no fixture files.
 */
import { createCanvas } from '@napi-rs/canvas';

/** Draws report lines as a white "paper" image, like a phone photo or scanner output. */
export const reportImage = (lines: string[], format: 'png' | 'jpeg' = 'png'): Buffer => {
  const width = 1400;
  const canvas = createCanvas(width, 120 + lines.length * 70);
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, width, canvas.height);
  g.fillStyle = '#111111';
  // Name common fonts first: on some Windows machines plain "sans-serif" maps to a narrow display font OCR misreads
  g.font = '34px Arial, "Liberation Sans", "DejaVu Sans", Helvetica, sans-serif';
  lines.forEach((t, i) => g.fillText(t, 50, 90 + i * 70));
  return format === 'png' ? canvas.toBuffer('image/png') : canvas.toBuffer('image/jpeg', 92);
};

/** Assembles PDF objects and writes a correct cross-reference table. */
const assemble = (objects: Buffer[]): Buffer => {
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const offsets: number[] = [];
  let length = chunks[0].length;
  objects.forEach((body, i) => {
    offsets.push(length);
    const obj = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from('\nendobj\n')]);
    chunks.push(obj);
    length += obj.length;
  });
  const xref =
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`;
  chunks.push(Buffer.from(xref));
  return Buffer.concat(chunks);
};

const esc = (s: string) => s.replace(/([\\()])/g, '\\$1');

/** One-page PDF whose text is selectable (a "digital" report). */
export const textPdf = (lines: string[]): Buffer => {
  const content = `BT /F1 14 Tf 60 780 Td 20 TL ${lines.map((l) => `(${esc(l)}) '`).join(' ')} ET`;
  return assemble([
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>'),
    Buffer.from(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  ]);
};

/** PDF pages that contain only a picture of the report — what a scanner produces. */
export const scannedPdf = (pages: string[][]): Buffer => {
  const objects: Buffer[] = [Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'), Buffer.alloc(0)];
  const kids: number[] = [];
  for (const lines of pages) {
    const jpeg = reportImage(lines, 'jpeg');
    const canvasH = 120 + lines.length * 70;
    const pageNo = objects.length + 1;
    const contentNo = pageNo + 1;
    const imageNo = pageNo + 2;
    const h = Math.round((842 * canvasH) / 1400 > 842 ? 842 : (595 * canvasH) / 1400);
    const draw = `q 595 0 0 ${h} 0 ${842 - h} cm /Im0 Do Q`;
    objects.push(
      Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${imageNo} 0 R >> >> /Contents ${contentNo} 0 R >>`),
      Buffer.from(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`),
      Buffer.concat([
        Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1400 /Height ${canvasH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
        jpeg,
        Buffer.from('\nendstream')
      ])
    );
    kids.push(pageNo);
  }
  objects[1] = Buffer.from(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
  return assemble(objects);
};
