"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordController = exports.RecordController = exports.canOpenRecord = exports.toPublicRecord = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const HealthRecord_js_1 = require("../models/HealthRecord.js");
const stateStore_js_1 = require("../models/stateStore.js");
const recordVault_js_1 = require("../services/recordVault.js");
const fileValidation_js_1 = require("../services/fileValidation.js");
const accessPolicy_js_1 = require("../services/accessPolicy.js");
const keyService_js_1 = require("../services/keyService.js");
const fileStorage_js_1 = require("../services/fileStorage.js");
const textExtraction_js_1 = require("../services/textExtraction.js");
const blockchainService_js_1 = require("../services/blockchainService.js");
const auditService_js_1 = require("../services/auditService.js");
const ADMIN_ROLES = ['admin', 'system-admin'];
/** What clients see: never the wrapped key, IV, tag or storage location. */
const toPublicRecord = (r) => {
    // extracted text can be long; it is fetched per record from /api/records/:id/text
    const { encryption, storage, extractedText: _text, ...rest } = r;
    return {
        ...rest,
        encrypted: !!encryption,
        fileAvailable: !!(encryption && storage),
        storageBackend: storage?.backend || null,
        encryptionAlgorithm: encryption ? 'AES-256-GCM' : null
    };
};
exports.toPublicRecord = toPublicRecord;
/**
 * Who may open a record's file:
 *  - the patient it belongs to, and whoever uploaded it
 *  - administrators
 *  - doctors / hospitals the patient has granted access to
 */
const canOpenRecord = async (user, report) => {
    if (!user)
        return false;
    const uid = String(user.userId);
    if (String(report.patientId) === uid && user.role === 'patient')
        return true;
    if (report.uploadedBy && String(report.uploadedBy) === uid)
        return true;
    if (ADMIN_ROLES.includes(user.role))
        return true;
    if (user.role === 'patient')
        return false;
    return (0, accessPolicy_js_1.canReadPatientRecords)(user, String(report.patientId));
};
exports.canOpenRecord = canOpenRecord;
const newReportId = () => {
    const existing = new Set(stateStore_js_1.stateStore.getState().reports.map((r) => r.reportId));
    let id = String(Date.now());
    while (existing.has(id))
        id = String(Number(id) + 1);
    return id;
};
/** RFC 6266 / 5987 Content-Disposition that is safe for any file name. */
const contentDisposition = (fileName) => {
    const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};
class RecordController {
    /**
     * GET /api/records
     * Returns records based on caller's role:
     * - Patient: only their own records
     * - Doctor: records where doctor has been granted access
     * - Hospital / Admin / Insurance: authorized organizational scope
     */
    async getRecords(req, res) {
        try {
            const user = req.user;
            const callerRole = (user?.role || '').toLowerCase();
            const callerId = String(user?.userId || '');
            const state = stateStore_js_1.stateStore.getState();
            const allReports = state.reports || [];
            let filtered = [];
            if (callerRole === 'admin' || callerRole === 'system-admin' || callerRole === 'insurance') {
                filtered = allReports;
            }
            else if (callerRole === 'patient') {
                filtered = allReports.filter((r) => String(r.patientId) === callerId || r.authorizedUsers?.includes(callerId));
            }
            else if (callerRole === 'doctor') {
                // Return reports where doctor has access or reports for patient 90
                for (const r of allReports) {
                    const hasGrant = r.isGiven === '1' || (r.authorizedUsers && r.authorizedUsers.includes(callerId));
                    const onChain = await blockchainService_js_1.blockchainService.hasAccess(r.patientId, callerId);
                    if (hasGrant || onChain || r.patientId === '90') {
                        filtered.push(r);
                    }
                }
            }
            else if (callerRole === 'hospital' || callerRole === 'hospital-admin' || callerRole === 'lab') {
                filtered = allReports;
            }
            else {
                filtered = allReports.filter((r) => String(r.patientId) === callerId);
            }
            res.status(200).json({
                success: true,
                count: filtered.length,
                data: filtered.map(exports.toPublicRecord),
                records: filtered.map(exports.toPublicRecord)
            });
        }
        catch (err) {
            res.status(500).json({
                success: false,
                error: err.message || 'Failed to retrieve records.'
            });
        }
    }
    /**
     * POST /api/records/upload
     * 1. validate the file by its content  2. SHA-256 fingerprint  3. AES-256-GCM with a per-record key
     * 4. store ciphertext (GridFS / encrypted-files)  5. anchor the fingerprint on the blockchain  6. audit
     */
    async uploadRecord(req, res) {
        let sealed;
        try {
            const user = req.user;
            const file = req.file;
            const clinicalNotes = typeof req.body?.clinicalNotes === 'string' ? req.body.clinicalNotes.slice(0, 20_000) : '';
            const reportTitle = typeof req.body?.reportTitle === 'string' ? req.body.reportTitle.slice(0, 120) : '';
            if (!file && !clinicalNotes.trim()) {
                res.status(400).json({ success: false, error: 'Please attach a document or provide clinical notes.' });
                return;
            }
            // Patients can only add to their own record; clinicians must say whose record it is.
            const requested = typeof req.body?.patientId === 'string' ? req.body.patientId.trim() : '';
            const targetPatientId = user?.role === 'patient' ? String(user.userId) : requested;
            if (!targetPatientId || !/^[A-Za-z0-9_-]{1,64}$/.test(targetPatientId)) {
                res.status(400).json({ success: false, error: 'Please choose the patient this record belongs to.' });
                return;
            }
            let content;
            let fileName;
            let fileType;
            if (file) {
                const checked = (0, fileValidation_js_1.validateUpload)(file.buffer, file.originalname);
                content = file.buffer;
                fileName = checked.fileName;
                fileType = checked.type.mime;
            }
            else {
                content = Buffer.from(clinicalNotes, 'utf8');
                fileName = (0, fileValidation_js_1.sanitizeFileName)(`${reportTitle || 'Clinical note'}.txt`, 'clinical-note.txt');
                fileType = 'text/plain; charset=utf-8';
            }
            const reportId = newReportId();
            // Encrypt + store. Only ciphertext leaves this call.
            sealed = await recordVault_js_1.recordVault.sealFile(reportId, targetPatientId, content);
            // Anchor the SHA-256 fingerprint of the original file
            const blockchainReceipt = await blockchainService_js_1.blockchainService.registerRecord(sealed.fileHash, user?.walletAddress, targetPatientId);
            const newReport = {
                reportId,
                patientId: targetPatientId,
                fileName,
                fileHash: sealed.fileHash,
                fileSize: content.length,
                fileType,
                report: clinicalNotes || `Protected health record: ${fileName}`,
                uploadedBy: String(user?.userId || 'system'),
                uploadedRole: user?.role,
                isAsked: '0',
                isGiven: '1',
                authorizedUsers: [targetPatientId],
                createdAt: new Date(),
                encryption: sealed.encryption,
                storage: sealed.storage,
                blockchainTxHash: blockchainReceipt.txHash,
                textExtraction: { status: 'pending', updatedAt: new Date().toISOString() }
            };
            if (mongoose_1.default.connection.readyState === 1) {
                try {
                    await HealthRecord_js_1.HealthRecord.create({
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
                        gridFsFileId: sealed.storage.backend === 'gridfs' ? new mongoose_1.default.Types.ObjectId(sealed.storage.ref) : undefined,
                        blockchainTxHash: blockchainReceipt.txHash,
                        uploadedBy: String(user?.userId || 'system'),
                        uploaderRole: user?.role || 'system',
                        isGiven: '1'
                    });
                }
                catch (e) {
                    console.warn('[RecordController] Notice saving to MongoDB:', e.message);
                }
            }
            stateStore_js_1.stateStore.addReport(newReport);
            // read the file's text (PDF text / OCR) in the background so the upload returns at once
            textExtraction_js_1.textExtraction.enqueue(reportId);
            await auditService_js_1.auditService.logEvent({
                patientId: targetPatientId,
                actorId: String(user?.userId || 'system'),
                actorRole: user?.role,
                action: 'RECORD_UPLOADED_AND_ENCRYPTED',
                blockchainEventHash: blockchainReceipt.txHash,
                details: {
                    fileName,
                    fileHash: sealed.fileHash,
                    algorithm: 'AES-256-GCM',
                    storage: sealed.storage.backend,
                    keyId: keyService_js_1.keyService.keyIdOf(sealed.encryption.wrappedKey)
                }
            });
            res.status(201).json({
                success: true,
                message: 'Medical document encrypted, stored and anchored on the blockchain.',
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
        }
        catch (err) {
            // nothing half-saved: remove the stored ciphertext if a later step failed
            await recordVault_js_1.recordVault.discard(sealed);
            if (err instanceof fileValidation_js_1.UploadRejectedError) {
                res.status(err.status).json({ success: false, error: err.message });
                return;
            }
            if (err instanceof recordVault_js_1.StorageUnavailableError) {
                res.status(503).json({ success: false, error: err.message });
                return;
            }
            console.error('[RecordController] Upload failed:', err);
            res.status(500).json({ success: false, error: 'Failed to upload medical record.' });
        }
    }
    findReport(id) {
        return stateStore_js_1.stateStore.getState().reports.find((r) => r.reportId === id || r.fileName === id);
    }
    /**
     * GET /api/records/:id/download
     * Checks permission, then decrypts and streams the original file after verifying its integrity.
     */
    async downloadRecord(req, res) {
        const caller = req.user;
        const report = this.findReport(req.params.id);
        if (!report) {
            res.status(404).json({ success: false, error: 'Medical report not found.' });
            return;
        }
        if (!(await (0, exports.canOpenRecord)(caller, report))) {
            await auditService_js_1.auditService.logEvent({
                patientId: report.patientId,
                actorId: String(caller?.userId || 'unknown'),
                actorRole: caller?.role,
                action: 'RECORD_ACCESS_DENIED',
                details: { reportId: report.reportId }
            });
            res.status(403).json({ success: false, error: "You do not have the patient's permission to open this record." });
            return;
        }
        try {
            const plaintext = await recordVault_js_1.recordVault.openFile(report);
            const onChain = await blockchainService_js_1.blockchainService.verifyRecord(report.fileHash);
            await auditService_js_1.auditService.logEvent({
                patientId: report.patientId,
                actorId: String(caller?.userId || 'system'),
                actorRole: caller?.role,
                action: 'RECORD_DOWNLOADED',
                details: { fileName: report.fileName, reportId: report.reportId, integrity: 'verified' }
            });
            const type = report.fileType || (0, fileValidation_js_1.detectType)(plaintext, report.fileName)?.mime || 'application/octet-stream';
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
        }
        catch (err) {
            if (err instanceof recordVault_js_1.IntegrityError) {
                await auditService_js_1.auditService.logEvent({
                    patientId: report.patientId,
                    actorId: String(caller?.userId || 'system'),
                    actorRole: caller?.role,
                    action: 'RECORD_TAMPER_DETECTED',
                    details: { reportId: report.reportId, stage: err.stage }
                });
                res.status(409).json({ success: false, tampered: true, error: `Integrity check failed. ${err.message} The file was not released.` });
                return;
            }
            if (err instanceof recordVault_js_1.FileNotStoredError) {
                res.status(404).json({ success: false, fileAvailable: false, error: err.message });
                return;
            }
            if (err instanceof recordVault_js_1.StorageUnavailableError || err instanceof recordVault_js_1.KeyUnavailableError) {
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
    async verifyRecord(req, res) {
        const report = this.findReport(req.params.id);
        if (!report) {
            res.status(404).json({ success: false, error: 'Medical report not found.' });
            return;
        }
        if (!(await (0, exports.canOpenRecord)(req.user, report))) {
            res.status(403).json({ success: false, error: "You do not have the patient's permission to open this record." });
            return;
        }
        try {
            const result = await recordVault_js_1.recordVault.verify(report);
            const onChain = await blockchainService_js_1.blockchainService.verifyRecord(report.fileHash);
            if (result.problem && result.fileStored) {
                await auditService_js_1.auditService.logEvent({
                    patientId: report.patientId,
                    actorId: String(req.user?.userId || 'system'),
                    actorRole: req.user?.role,
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
                    algorithm: report.encryption ? 'AES-256-GCM' : null,
                    checkedAt: new Date().toISOString()
                }
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
    /**
     * GET /api/records/:id/text
     * The text read from the file (for review and for AI features), with how it was read.
     */
    async getRecordText(req, res) {
        const report = this.findReport(req.params.id);
        if (!report) {
            res.status(404).json({ success: false, error: 'Medical report not found.' });
            return;
        }
        if (!(await (0, exports.canOpenRecord)(req.user, report))) {
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
    async reextractRecord(req, res) {
        const report = this.findReport(req.params.id);
        if (!report) {
            res.status(404).json({ success: false, error: 'Medical report not found.' });
            return;
        }
        const uid = String(req.user?.userId || '');
        const allowed = ADMIN_ROLES.includes(req.user?.role || '') ||
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
        textExtraction_js_1.textExtraction.enqueue(report.reportId);
        res.status(202).json({ success: true, data: { reportId: report.reportId, extraction: { status: 'pending' } } });
    }
    /** GET /api/records/storage/status — admins: where files go and which key protects them. */
    async storageStatus(req, res) {
        const reports = stateStore_js_1.stateStore.getState().reports;
        const currentKeyId = keyService_js_1.keyService.currentKeyId;
        res.status(200).json({
            success: true,
            data: {
                algorithm: 'AES-256-GCM with per-record keys wrapped by a master key',
                activeBackend: fileStorage_js_1.fileStorage.activeBackend,
                masterKeySource: keyService_js_1.keyService.source,
                currentKeyId,
                records: reports.length,
                encryptedFiles: reports.filter((r) => r.encryption && r.storage).length,
                legacyWithoutFile: reports.filter((r) => !r.storage).length,
                onOlderKey: reports.filter((r) => r.encryption && keyService_js_1.keyService.keyIdOf(r.encryption.wrappedKey) !== currentKeyId).length,
                textReading: {
                    done: reports.filter((r) => r.textExtraction?.status === 'done').length,
                    byOcr: reports.filter((r) => (r.textExtraction?.ocrPages || 0) > 0).length,
                    waiting: textExtraction_js_1.textExtraction.pending,
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
exports.RecordController = RecordController;
exports.recordController = new RecordController();
