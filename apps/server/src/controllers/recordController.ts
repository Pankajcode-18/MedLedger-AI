import { Response } from 'express';
import mongoose from 'mongoose';
import { HealthRecord } from '../models/HealthRecord.js';
import { stateStore } from '../models/stateStore.js';
import { recordVault, IntegrityError, FileNotStoredError, StorageUnavailableError, KeyUnavailableError, SealedFile } from '../services/recordVault.js';
import { validateUpload, sanitizeFileName, UploadRejectedError, detectType } from '../services/fileValidation.js';
import { canReadPatientRecords } from '../services/accessPolicy.js';
import { consentService } from '../services/consentService.js';
import { orgCollections } from '../services/orgCollections.js';
import { keyService } from '../services/keyService.js';
import { fileStorage } from '../services/fileStorage.js';
import { textExtraction } from '../services/textExtraction.js';
import { blockchainService } from '../services/blockchainService.js';
import { auditService } from '../services/auditService.js';
import { AuthenticatedRequest, AuthenticatedUser, IMedicalReport, UserRole } from '../types/index.js';

const ADMIN_ROLES = ['admin', 'system-admin'];

/** What clients see: never the wrapped key, IV, tag or storage location. */
/** userId → display name, rebuilt only when the user list changes (a lookup per record was O(users)). */
let names: { users: unknown; size: number; map: Map<string, string> } | null = null;
const uploaderName = (id?: string): string | null => {
  if (!id) return null;
  const users = stateStore.getState().users || [];
  if (!names || names.users !== users || names.size !== users.length) {
    names = { users, size: users.length, map: new Map(users.map((u) => [u.userId, u.name])) };
  }
  return names.map.get(String(id)) || null;
};

export const toPublicRecord = (r: IMedicalReport) => {
  // extracted text can be long; it is fetched per record from /api/records/:id/text
  const { encryption, storage, extractedText: _text, ...rest } = r;
  return {
    ...rest,
    uploaderName: uploaderName(r.uploadedBy),
    encrypted: !!encryption,
    fileAvailable: !!(encryption && storage),
    storageBackend: storage?.backend || null,
    encryptionAlgorithm: encryption ? 'AES-256-GCM' : null
  };
};

/** The fields a list or notification needs — no notes, no sharing lists, no extraction details. */
export const toRecordSummary = (r: IMedicalReport) => ({
  reportId: r.reportId,
  type: r.type,
  patientId: r.patientId,
  fileName: r.fileName,
  fileType: r.fileType,
  fileSize: r.fileSize,
  description: r.description,
  createdAt: r.createdAt,
  uploadedBy: r.uploadedBy,
  uploadedRole: r.uploadedRole,
  uploaderName: uploaderName(r.uploadedBy),
  fileHash: r.fileHash,
  blockchainTxHash: r.blockchainTxHash,
  encrypted: !!r.encryption,
  fileAvailable: !!(r.encryption && r.storage),
  textStatus: r.textExtraction?.status || null
});

/**
 * Who may open a record's file:
 *  - the patient it belongs to, and whoever uploaded it
 *  - administrators
 *  - doctors / hospitals the patient has granted access to
 */
export const canOpenRecord = async (user: AuthenticatedUser | undefined, report: IMedicalReport): Promise<boolean> => {
  if (!user) return false;
  const uid = String(user.userId);
  if (String(report.patientId) === uid && user.role === 'patient') return true;
  if (report.uploadedBy && String(report.uploadedBy) === uid) return true;
  if (ADMIN_ROLES.includes(user.role)) return true;
  if (user.role === 'patient') return false;
  if (user.role === 'insurance') return claimReportIds(uid).has(report.reportId);
  return canReadPatientRecords(user, String(report.patientId));
};

/** Reports an insurer may open: the ones attached to its own claims. */
const claimReportIds = (insurerId: string): Set<string> =>
  new Set(
    orgCollections
      .list('claims', insurerId)
      .map((c) => String(c.reportId || ''))
      .filter(Boolean)
  );

/**
 * Which reports a user's record list shows — the same rule as opening one:
 *  patient = own; doctor/hospital = patients who share with them, plus what they uploaded;
 *  lab = what it uploaded; insurer = reports attached to its claims; admin = all.
 */
export const visibleReports = (user: AuthenticatedUser | undefined, all: IMedicalReport[]): IMedicalReport[] => {
  if (!user) return [];
  const uid = String(user.userId);
  const role = user.role;
  if (ADMIN_ROLES.includes(role)) return all;
  if (role === 'patient') return all.filter((r) => String(r.patientId) === uid);
  if (role === 'lab') return all.filter((r) => String(r.uploadedBy) === uid);
  if (role === 'insurance') {
    const ids = claimReportIds(uid);
    return all.filter((r) => ids.has(r.reportId));
  }
  if (role === 'doctor' || role === 'hospital' || role === 'hospital-admin') {
    // who shares with this user, looked up once for the whole list
    const sharing = consentService.grantedPatients(uid);
    if (user.walletAddress) consentService.grantedPatients(user.walletAddress).forEach((p) => sharing.add(p));
    return all.filter((r) => String(r.uploadedBy) === uid || sharing.has(String(r.patientId)));
  }
  return [];
};

const newReportId = (): string => {
  const existing = new Set(stateStore.getState().reports.map((r) => r.reportId));
  let id = String(Date.now());
  while (existing.has(id)) id = String(Number(id) + 1);
  return id;
};

/** RFC 6266 / 5987 Content-Disposition that is safe for any file name. */
const contentDisposition = (fileName: string): string => {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};

export class RecordController {
  /**
   * GET /api/records
   * Returns records based on caller's role:
   * - Patient: only their own records
   * - Doctor: records where doctor has been granted access
   * - Hospital / Admin / Insurance: authorized organizational scope
   */
  public async getRecords(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user;
      const state = stateStore.getState();
      const allReports = state.reports || [];

      const filtered = visibleReports(user, allReports);

      // optional paging: ?limit=25&offset=0 (newest first) and ?fields=summary for lists and notifications
      const limit = Math.min(200, Math.max(0, parseInt(String(req.query.limit || '0'), 10) || 0));
      const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);
      const summary = req.query.fields === 'summary';
      const shape = (r: IMedicalReport): Record<string, unknown> => (summary ? toRecordSummary(r) : toPublicRecord(r));
      if (limit) {
        const newestFirst = [...filtered].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime() || Number(b.reportId) - Number(a.reportId));
        const page = newestFirst.slice(offset, offset + limit).map(shape);
        res.status(200).json({ success: true, count: page.length, total: filtered.length, offset, limit, hasMore: offset + limit < filtered.length, data: page });
        return;
      }
      const data = filtered.map(shape);
      res.status(200).json({ success: true, count: filtered.length, total: filtered.length, data, records: data });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: (err as Error).message || 'Failed to retrieve records.'
      });
    }
  }

  /**
   * POST /api/records/upload
   * 1. validate the file by its content  2. SHA-256 fingerprint  3. AES-256-GCM with a per-record key
   * 4. store ciphertext (GridFS / encrypted-files)  5. anchor the fingerprint on the blockchain  6. audit
   */
  public async uploadRecord(req: AuthenticatedRequest, res: Response): Promise<void> {
    let sealed: SealedFile | undefined;
    try {
      const user = req.user;
      const file = req.file;
      const clinicalNotes = typeof req.body?.clinicalNotes === 'string' ? req.body.clinicalNotes.slice(0, 20_000) : '';
      const reportTitle = typeof req.body?.reportTitle === 'string' ? req.body.reportTitle.slice(0, 120) : '';

      if (!file && !clinicalNotes.trim()) {
        res.status(400).json({ success: false, error: 'Please attach a document or provide clinical notes.' });
        return;
      }

      // Insurers only receive documents attached to a claim; they never add to a patient's record.
      if (user?.role === 'insurance') {
        res.status(403).json({ success: false, error: 'Insurance accounts cannot add documents to a patient’s health record.' });
        return;
      }
      // Patients can only add to their own record; clinicians must say whose record it is.
      const requested = typeof req.body?.patientId === 'string' ? req.body.patientId.trim() : '';
      const targetPatientId = user?.role === 'patient' ? String(user.userId) : requested;
      if (!targetPatientId || !/^[A-Za-z0-9_-]{1,64}$/.test(targetPatientId)) {
        res.status(400).json({ success: false, error: 'Please choose the patient this record belongs to.' });
        return;
      }
      if (user?.role === 'doctor' && !(await canReadPatientRecords(user, targetPatientId))) {
        res.status(403).json({ success: false, error: 'This patient has not shared their records with you, so you cannot add to them.' });
        return;
      }

      let content: Buffer;
      let fileName: string;
      let fileType: string;
      if (file) {
        const checked = validateUpload(file.buffer, file.originalname);
        content = file.buffer;
        fileName = checked.fileName;
        fileType = checked.type.mime;
      } else {
        content = Buffer.from(clinicalNotes, 'utf8');
        fileName = sanitizeFileName(`${reportTitle || 'Clinical note'}.txt`, 'clinical-note.txt');
        fileType = 'text/plain; charset=utf-8';
      }

      const reportId = newReportId();

      // Encrypt + store. Only ciphertext leaves this call.
      sealed = await recordVault.sealFile(reportId, targetPatientId, content);

      // Anchor the SHA-256 fingerprint of the original file
      const blockchainReceipt = await blockchainService.registerRecord(sealed.fileHash, user?.walletAddress, targetPatientId);

      const newReport: IMedicalReport = {
        reportId,
        patientId: targetPatientId,
        fileName,
        fileHash: sealed.fileHash,
        fileSize: content.length,
        fileType,
        report: clinicalNotes || `Protected health record: ${fileName}`,
        uploadedBy: String(user?.userId || 'system'),
        uploadedRole: user?.role as UserRole,
        description: reportTitle || undefined,
        isAsked: '0',
        isGiven: consentService.grantedDoctors(targetPatientId).length ? '1' : '0',
        authorizedUsers: consentService.authorizedFor(targetPatientId),
        createdAt: new Date(),
        encryption: sealed.encryption,
        storage: sealed.storage,
        blockchainTxHash: blockchainReceipt.txHash,
        textExtraction: { status: 'pending', updatedAt: new Date().toISOString() }
      };

      if (mongoose.connection.readyState === 1) {
        try {
          await HealthRecord.create({
            reportId,
            patientId: targetPatientId,
            fileName,
            fileHash: sealed.fileHash,
            fileType,
            fileSize: content.length,
            iv: sealed.encryption.iv,
            authTag: sealed.encryption.authTag,
            wrappedKey: sealed.encryption.wrappedKey,
            storageBackend: sealed.storage.backend,
            storageRef: sealed.storage.ref,
            ciphertextSha256: sealed.storage.ciphertextSha256,
            gridFsFileId: sealed.storage.backend === 'gridfs' ? new mongoose.Types.ObjectId(sealed.storage.ref) : undefined,
            blockchainTxHash: blockchainReceipt.txHash,
            uploadedBy: String(user?.userId || 'system'),
            uploaderRole: user?.role || 'system',
            isGiven: '1'
          });
        } catch (e) {
          console.warn('[RecordController] Notice saving to MongoDB:', (e as Error).message);
        }
      }

      stateStore.addReport(newReport);
      // read the file's text (PDF text / OCR) in the background so the upload returns at once
      textExtraction.enqueue(reportId);

      await auditService.logEvent({
        patientId: targetPatientId,
        actorId: String(user?.userId || 'system'),
        actorRole: user?.role as UserRole,
        action: 'RECORD_UPLOADED_AND_ENCRYPTED',
        blockchainEventHash: blockchainReceipt.txHash,
        details: {
          reportId,
          fileName,
          fileHash: sealed.fileHash,
          algorithm: 'AES-256-GCM',
          storage: sealed.storage.backend,
          keyId: keyService.keyIdOf(sealed.encryption.wrappedKey)
        }
      });

      res.status(201).json({
        success: true,
        message: 'Report saved and locked. Its fingerprint is in the record history.',
        data: {
          reportId,
          fileName,
          fileHash: sealed.fileHash,
          fileSize: content.length,
          fileType,
          encrypted: true,
          encryptionAlgorithm: 'AES-256-GCM',
          storageBackend: sealed.storage.backend,
          blockchainTxHash: blockchainReceipt.txHash,
          txHash: blockchainReceipt.txHash,
          blockNumber: blockchainReceipt.blockNumber,
          textExtraction: { status: 'pending' }
        }
      });
    } catch (err: unknown) {
      // nothing half-saved: remove the stored ciphertext if a later step failed
      await recordVault.discard(sealed);
      if (err instanceof UploadRejectedError) {
        res.status(err.status).json({ success: false, error: err.message });
        return;
      }
      if (err instanceof StorageUnavailableError) {
        res.status(503).json({ success: false, error: err.message });
        return;
      }
      console.error('[RecordController] Upload failed:', err);
      res.status(500).json({ success: false, error: 'Failed to upload medical record.' });
    }
  }

  private findReport(id: string): IMedicalReport | undefined {
    return stateStore.getState().reports.find((r) => r.reportId === id || r.fileName === id);
  }

  /**
   * GET /api/records/:id/download
   * Checks permission, then decrypts and streams the original file after verifying its integrity.
   */
  public async downloadRecord(req: AuthenticatedRequest, res: Response): Promise<void> {
    const caller = req.user;
    const report = this.findReport(req.params.id);
    if (!report) {
      res.status(404).json({ success: false, error: 'Medical report not found.' });
      return;
    }

    if (!(await canOpenRecord(caller, report))) {
      await auditService.logEvent({
        patientId: report.patientId,
        actorId: String(caller?.userId || 'unknown'),
        actorRole: caller?.role as UserRole,
        action: 'RECORD_ACCESS_DENIED',
        details: { reportId: report.reportId }
      });
      res.status(403).json({ success: false, error: "You do not have the patient's permission to open this record." });
      return;
    }

    try {
      const plaintext = await recordVault.openFile(report);
      const onChain = await blockchainService.verifyRecord(report.fileHash);

      await auditService.logEvent({
        patientId: report.patientId,
        actorId: String(caller?.userId || 'system'),
        actorRole: caller?.role as UserRole,
        action: 'RECORD_DOWNLOADED',
        details: { fileName: report.fileName, reportId: report.reportId, integrity: 'verified' }
      });

      const type = report.fileType || detectType(plaintext, report.fileName)?.mime || 'application/octet-stream';
      res.setHeader('Content-Type', type);
      res.setHeader('Content-Length', String(plaintext.length));
      res.setHeader('Content-Disposition', contentDisposition(report.fileName));
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-File-SHA256', report.fileHash);
      res.setHeader('X-Integrity-Verified', 'true');
      res.setHeader('X-Blockchain-Anchored', String(onChain));
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-File-SHA256, X-Integrity-Verified, X-Blockchain-Anchored');
      res.status(200).end(plaintext);
    } catch (err) {
      if (err instanceof IntegrityError) {
        await auditService.logEvent({
          patientId: report.patientId,
          actorId: String(caller?.userId || 'system'),
          actorRole: caller?.role as UserRole,
          action: 'RECORD_TAMPER_DETECTED',
          details: { reportId: report.reportId, stage: err.stage }
        });
        res.status(409).json({ success: false, tampered: true, error: `Integrity check failed. ${err.message} The file was not released.` });
        return;
      }
      if (err instanceof FileNotStoredError) {
        res.status(404).json({ success: false, fileAvailable: false, error: err.message });
        return;
      }
      if (err instanceof StorageUnavailableError || err instanceof KeyUnavailableError) {
        res.status(503).json({ success: false, error: err.message });
        return;
      }
      console.error('[RecordController] Download failed:', err);
      res.status(500).json({ success: false, error: 'Failed to open the record.' });
    }
  }

  /**
   * GET /api/records/:id/verify
   * Full integrity check without releasing the file: storage, ciphertext hash, GCM tag,
   * SHA-256 fingerprint and the blockchain anchor.
   */
  public async verifyRecord(req: AuthenticatedRequest, res: Response): Promise<void> {
    const report = this.findReport(req.params.id);
    if (!report) {
      res.status(404).json({ success: false, error: 'Medical report not found.' });
      return;
    }
    if (!(await canOpenRecord(req.user, report))) {
      res.status(403).json({ success: false, error: "You do not have the patient's permission to open this record." });
      return;
    }
    try {
      const result = await recordVault.verify(report);
      const onChain = await blockchainService.verifyRecord(report.fileHash);
      if (result.problem && result.fileStored) {
        await auditService.logEvent({
          patientId: report.patientId,
          actorId: String(req.user?.userId || 'system'),
          actorRole: req.user?.role as UserRole,
          action: 'RECORD_TAMPER_DETECTED',
          details: { reportId: report.reportId, via: 'verify' }
        });
      }
      res.status(200).json({
        success: true,
        data: {
          ...result,
          fileHash: report.fileHash,
          blockchainAnchored: onChain,
          history: blockchainService.recordStatus(report.fileHash),
          algorithm: report.encryption ? 'AES-256-GCM' : null,
          checkedAt: new Date().toISOString()
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }

  /**
   * GET /api/records/:id/text
   * The text read from the file (for review and for AI features), with how it was read.
   */
  public async getRecordText(req: AuthenticatedRequest, res: Response): Promise<void> {
    const report = this.findReport(req.params.id);
    if (!report) {
      res.status(404).json({ success: false, error: 'Medical report not found.' });
      return;
    }
    if (!(await canOpenRecord(req.user, report))) {
      res.status(403).json({ success: false, error: "You do not have the patient's permission to open this record." });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data: {
        reportId: report.reportId,
        fileName: report.fileName,
        notes: report.report || '',
        text: report.extractedText || '',
        extraction: report.textExtraction || { status: report.storage ? 'pending' : 'unsupported' }
      }
    });
  }

  /** POST /api/records/:id/extract — read the file again (e.g. after enabling another OCR language). */
  public async reextractRecord(req: AuthenticatedRequest, res: Response): Promise<void> {
    const report = this.findReport(req.params.id);
    if (!report) {
      res.status(404).json({ success: false, error: 'Medical report not found.' });
      return;
    }
    const uid = String(req.user?.userId || '');
    const allowed =
      ADMIN_ROLES.includes(req.user?.role || '') ||
      (req.user?.role === 'patient' && String(report.patientId) === uid) ||
      String(report.uploadedBy) === uid;
    if (!allowed) {
      res.status(403).json({ success: false, error: 'Only the patient, the uploader or an administrator can do this.' });
      return;
    }
    if (!report.storage) {
      res.status(409).json({ success: false, error: 'There is no stored file to read for this record.' });
      return;
    }
    textExtraction.enqueue(report.reportId);
    res.status(202).json({ success: true, data: { reportId: report.reportId, extraction: { status: 'pending' } } });
  }

  /**
   * PUT /api/records/:id/text { text }
   * The patient, the uploader or an administrator checks the text read from a scan or photo and saves
   * a corrected version. Corrected text counts as checked by a person, so the full AI assistant may use it.
   * The stored file and its fingerprint are not changed.
   */
  public async correctRecordText(req: AuthenticatedRequest, res: Response): Promise<void> {
    const report = this.findReport(req.params.id);
    if (!report) {
      res.status(404).json({ success: false, error: 'Medical report not found.' });
      return;
    }
    const uid = String(req.user?.userId || '');
    const allowed =
      ADMIN_ROLES.includes(req.user?.role || '') ||
      (req.user?.role === 'patient' && String(report.patientId) === uid) ||
      String(report.uploadedBy) === uid;
    if (!allowed) {
      res.status(403).json({ success: false, error: 'Only the patient, the uploader or an administrator can correct this text.' });
      return;
    }
    const text = typeof req.body?.text === 'string' ? req.body.text.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim() : '';
    if (!text) {
      res.status(400).json({ success: false, error: 'Please enter the corrected text.' });
      return;
    }
    if (text.length > 100_000) {
      res.status(400).json({ success: false, error: 'The text is too long (100,000 characters at most).' });
      return;
    }
    const now = new Date().toISOString();
    const textExtractionInfo = {
      ...(report.textExtraction || { status: 'done' as const }),
      status: 'done' as const,
      chars: text.length,
      corrected: true,
      correctedAt: now,
      correctedBy: uid,
      updatedAt: now
    };
    stateStore.updateReport(report.reportId, { extractedText: text, textExtraction: textExtractionInfo });
    await auditService.logEvent({
      patientId: String(report.patientId),
      actorId: uid,
      actorRole: req.user?.role as UserRole,
      action: 'RECORD_TEXT_CORRECTED',
      details: { reportId: report.reportId, chars: text.length, previousConfidence: report.textExtraction?.confidence ?? null }
    });
    res.status(200).json({ success: true, data: { reportId: report.reportId, text, extraction: textExtractionInfo } });
  }

  /** GET /api/records/storage/status — admins: where files go and which key protects them. */
  public async storageStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const reports = stateStore.getState().reports;
    const currentKeyId = keyService.currentKeyId;
    res.status(200).json({
      success: true,
      data: {
        algorithm: 'AES-256-GCM with per-record keys wrapped by a master key',
        activeBackend: fileStorage.activeBackend,
        masterKeySource: keyService.source,
        currentKeyId,
        records: reports.length,
        encryptedFiles: reports.filter((r) => r.encryption && r.storage).length,
        legacyWithoutFile: reports.filter((r) => !r.storage).length,
        onOlderKey: reports.filter((r) => r.encryption && keyService.keyIdOf(r.encryption.wrappedKey) !== currentKeyId).length,
        textReading: {
          done: reports.filter((r) => r.textExtraction?.status === 'done').length,
          byOcr: reports.filter((r) => (r.textExtraction?.ocrPages || 0) > 0).length,
          waiting: textExtraction.pending,
          failed: reports.filter((r) => r.textExtraction?.status === 'failed').length
        },
        byBackend: {
          gridfs: reports.filter((r) => r.storage?.backend === 'gridfs').length,
          local: reports.filter((r) => r.storage?.backend === 'local').length
        }
      }
    });
  }
}

export const recordController = new RecordController();
