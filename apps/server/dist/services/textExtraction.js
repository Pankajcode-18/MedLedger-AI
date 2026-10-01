"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textExtraction = void 0;
const stateStore_js_1 = require("../models/stateStore.js");
const recordVault_js_1 = require("./recordVault.js");
const documentText_js_1 = require("./documentText.js");
const auditService_js_1 = require("./auditService.js");
/**
 * Background text extraction. Uploads return immediately; files are then decrypted in memory,
 * read (text layer / OCR), and the text is saved with the record — encrypted at rest.
 * One document at a time so OCR never starves the API.
 */
class TextExtractionQueue {
    queue = [];
    running = false;
    waiters = [];
    enqueue(reportId) {
        if (!this.queue.includes(reportId))
            this.queue.push(reportId);
        this.mark(reportId, { status: 'pending' });
        void this.run();
    }
    get pending() {
        return this.queue.length + (this.running ? 1 : 0);
    }
    /** Resolves when every queued document has been processed (used by tests and shutdown). */
    whenIdle() {
        if (!this.running && !this.queue.length)
            return Promise.resolve();
        return new Promise((resolve) => this.waiters.push(resolve));
    }
    /** Queues stored files that were never read, or whose reading was interrupted by a restart. */
    backfill() {
        let n = 0;
        for (const r of stateStore_js_1.stateStore.getState().reports) {
            if (!r.storage || !r.encryption)
                continue;
            const st = r.textExtraction?.status;
            if (!st || st === 'pending' || st === 'processing') {
                this.enqueue(r.reportId);
                n++;
            }
        }
        if (n)
            console.log(`[OCR] Reading text from ${n} stored document(s) in the background.`);
        return n;
    }
    mark(reportId, info, extractedText) {
        const updates = { textExtraction: { ...info, updatedAt: new Date().toISOString() } };
        if (extractedText !== undefined)
            updates.extractedText = extractedText;
        stateStore_js_1.stateStore.updateReport(reportId, updates);
    }
    async run() {
        if (this.running)
            return;
        this.running = true;
        try {
            while (this.queue.length) {
                const id = this.queue.shift();
                await this.process(id);
            }
        }
        finally {
            this.running = false;
            const w = this.waiters.splice(0);
            w.forEach((resolve) => resolve());
        }
    }
    async process(reportId) {
        const report = stateStore_js_1.stateStore.getState().reports.find((r) => r.reportId === reportId);
        if (!report)
            return;
        if (!report.storage || !report.encryption) {
            this.mark(reportId, { status: 'unsupported', warnings: ['No stored file to read.'] });
            return;
        }
        this.mark(reportId, { status: 'processing' });
        try {
            const file = await recordVault_js_1.recordVault.openFile(report);
            const result = await (0, documentText_js_1.extractDocumentText)(file, report.fileType || '');
            file.fill(0);
            // a note-only upload *is* its text file — do not store the same text twice
            const sameAsNotes = result.method === 'plain' && result.text.trim() === (report.report || '').trim();
            const text = sameAsNotes ? '' : result.text;
            this.mark(reportId, {
                status: result.method === 'unsupported' ? 'unsupported' : 'done',
                method: result.method,
                pages: result.pages,
                ocrPages: result.ocrPages,
                confidence: result.confidence,
                chars: result.text.length,
                language: result.language,
                durationMs: result.durationMs,
                warnings: sameAsNotes ? [...result.warnings, 'Same as the notes.'] : result.warnings
            }, text);
            await auditService_js_1.auditService.logEvent({
                patientId: report.patientId,
                actorId: 'system',
                actorRole: 'system',
                action: 'RECORD_TEXT_EXTRACTED',
                details: { reportId, method: result.method, pages: result.pages, ocrPages: result.ocrPages, confidence: result.confidence, chars: result.text.length }
            });
        }
        catch (err) {
            console.warn(`[OCR] Could not read record ${reportId}:`, err.message);
            this.mark(reportId, { status: 'failed', error: err.message });
        }
    }
}
exports.textExtraction = new TextExtractionQueue();
