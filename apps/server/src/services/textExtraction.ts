import { config } from '../config/index.js';
import { stateStore } from '../models/stateStore.js';
import { recordVault } from './recordVault.js';
import { extractDocumentText } from './documentText.js';
import { auditService } from './auditService.js';
import { ITextExtraction } from '../types/index.js';

/**
 * Background text extraction. Uploads return immediately; files are then decrypted in memory,
 * read (text layer / OCR), and the text is saved with the record — encrypted at rest.
 * One document at a time so OCR never starves the API.
 */
class TextExtractionQueue {
  private queue: string[] = [];
  private running = false;
  private waiters: Array<() => void> = [];

  public enqueue(reportId: string): void {
    if (!this.queue.includes(reportId)) this.queue.push(reportId);
    this.mark(reportId, { status: 'pending' });
    void this.run();
  }

  public get pending(): number {
    return this.queue.length + (this.running ? 1 : 0);
  }

  /** Resolves when every queued document has been processed (used by tests and shutdown). */
  public whenIdle(): Promise<void> {
    if (!this.running && !this.queue.length) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  /** Queues stored files that were never read, or whose reading was interrupted by a restart. */
  public backfill(): number {
    let n = 0;
    for (const r of stateStore.getState().reports) {
      if (!r.storage || !r.encryption) continue;
      const st = r.textExtraction?.status;
      if (!st || st === 'pending' || st === 'processing') {
        this.enqueue(r.reportId);
        n++;
      }
    }
    if (n) console.log(`[OCR] Reading text from ${n} stored document(s) in the background.`);
    return n;
  }

  private mark(reportId: string, info: Omit<ITextExtraction, 'updatedAt'>, extractedText?: string): void {
    const updates: Record<string, unknown> = { textExtraction: { ...info, updatedAt: new Date().toISOString() } };
    if (extractedText !== undefined) updates.extractedText = extractedText;
    stateStore.updateReport(reportId, updates);
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // as many documents at once as there are OCR workers
      const lane = async () => {
        while (this.queue.length) {
          const id = this.queue.shift() as string;
          await this.process(id);
        }
      };
      await Promise.all(Array.from({ length: Math.max(1, config.ocrWorkers) }, lane));
    } finally {
      this.running = false;
      const w = this.waiters.splice(0);
      w.forEach((resolve) => resolve());
    }
  }

  private async process(reportId: string): Promise<void> {
    const report = stateStore.getState().reports.find((r) => r.reportId === reportId);
    if (!report) return;
    if (!report.storage || !report.encryption) {
      this.mark(reportId, { status: 'unsupported', warnings: ['No stored file to read.'] });
      return;
    }

    this.mark(reportId, { status: 'processing' });
    try {
      const file = await recordVault.openFile(report);
      const result = await extractDocumentText(file, report.fileType || '');
      file.fill(0);

      // a note-only upload *is* its text file — do not store the same text twice
      const sameAsNotes = result.method === 'plain' && result.text.trim() === (report.report || '').trim();
      const text = sameAsNotes ? '' : result.text;

      this.mark(
        reportId,
        {
          status: result.method === 'unsupported' ? 'unsupported' : 'done',
          method: result.method,
          pages: result.pages,
          ocrPages: result.ocrPages,
          confidence: result.confidence,
          uncertainNumbers: result.uncertainNumbers,
          cleanedPhoto: result.cleanedPhoto,
          chars: result.text.length,
          language: result.language,
          durationMs: result.durationMs,
          warnings: sameAsNotes ? [...result.warnings, 'Same as the notes.'] : result.warnings
        },
        text
      );

      await auditService.logEvent({
        patientId: report.patientId,
        actorId: 'system',
        actorRole: 'system',
        action: 'RECORD_TEXT_EXTRACTED',
        details: { reportId, method: result.method, pages: result.pages, ocrPages: result.ocrPages, confidence: result.confidence, chars: result.text.length }
      });
    } catch (err) {
      console.warn(`[OCR] Could not read record ${reportId}:`, (err as Error).message);
      this.mark(reportId, { status: 'failed', error: (err as Error).message });
    }
  }
}

export const textExtraction = new TextExtractionQueue();
