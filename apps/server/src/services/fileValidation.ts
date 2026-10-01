import path from 'path';

/**
 * Upload checks. The file type is decided from the file's own bytes ("magic numbers"),
 * never from the name or the browser-supplied MIME type, and the detected type is what
 * downloads are served as.
 */

export interface DetectedType {
  mime: string;
  kind: 'pdf' | 'image' | 'dicom' | 'office' | 'text';
  extensions: string[];
}

const startsWith = (buf: Buffer, sig: number[], offset = 0): boolean =>
  buf.length >= offset + sig.length && sig.every((b, i) => buf[offset + i] === b);

const looksLikeText = (buf: Buffer): boolean => {
  const sample = buf.subarray(0, 8192);
  if (sample.includes(0)) return false;
  try {
    // stream mode tolerates a multi-byte character cut off at the end of the sample
    new TextDecoder('utf-8', { fatal: true }).decode(sample, { stream: sample.length < buf.length });
    return true;
  } catch {
    return false;
  }
};

export const detectType = (buf: Buffer, originalName = ''): DetectedType | null => {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: 'application/pdf', kind: 'pdf', extensions: ['.pdf'] };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', kind: 'image', extensions: ['.png'] };
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', kind: 'image', extensions: ['.jpg', '.jpeg'] };
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: 'image/webp', kind: 'image', extensions: ['.webp'] };
  }
  if (startsWith(buf, [0x44, 0x49, 0x43, 0x4d], 128)) return { mime: 'application/dicom', kind: 'dicom', extensions: ['.dcm', '.dicom'] };
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    // ZIP container: only accept Office Open XML documents
    const head = buf.subarray(0, Math.min(buf.length, 4096)).toString('latin1');
    const ext = path.extname(originalName).toLowerCase();
    if (ext === '.docx' || head.includes('word/')) {
      return { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'office', extensions: ['.docx'] };
    }
    if (ext === '.xlsx' || head.includes('xl/')) {
      return { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'office', extensions: ['.xlsx'] };
    }
    return null;
  }
  if (looksLikeText(buf)) {
    const ext = path.extname(originalName).toLowerCase();
    if (ext === '.csv') return { mime: 'text/csv; charset=utf-8', kind: 'text', extensions: ['.csv'] };
    return { mime: 'text/plain; charset=utf-8', kind: 'text', extensions: ['.txt', '.csv', '.md', ''] };
  }
  return null;
};

export const ALLOWED_DESCRIPTION = 'PDF, PNG, JPEG, WebP, DICOM, Word (.docx), Excel (.xlsx) or plain text';

/** Keeps only a safe display name: no folders, control characters or odd punctuation. */
export const sanitizeFileName = (name: string, fallback = 'medical-record'): string => {
  const base = path.basename(String(name || '').replace(/\\/g, '/'));
  const cleaned = base
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+/, '')
    .trim()
    .slice(0, 150);
  return cleaned || fallback;
};

/** Makes sure the stored name ends with an extension that matches the real content. */
export const withMatchingExtension = (name: string, type: DetectedType): string => {
  const ext = path.extname(name).toLowerCase();
  if (type.extensions.includes(ext)) return name;
  const preferred = type.extensions.find((e) => e) || '';
  return `${name}${preferred}`;
};

export class UploadRejectedError extends Error {
  constructor(message: string, public status = 415) {
    super(message);
  }
}

export const validateUpload = (buf: Buffer, originalName: string): { type: DetectedType; fileName: string } => {
  if (!buf.length) throw new UploadRejectedError('The file is empty.', 400);
  const type = detectType(buf, originalName);
  if (!type) throw new UploadRejectedError(`This file type is not accepted. Please upload a ${ALLOWED_DESCRIPTION} file.`);
  return { type, fileName: withMatchingExtension(sanitizeFileName(originalName), type) };
};
