"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordVault = exports.sha256Hex = exports.StorageUnavailableError = exports.KeyUnavailableError = exports.FileNotStoredError = exports.IntegrityError = void 0;
const crypto_1 = __importDefault(require("crypto"));
const encryptionService_js_1 = require("./encryptionService.js");
const keyService_js_1 = require("./keyService.js");
const fileStorage_js_1 = require("./fileStorage.js");
Object.defineProperty(exports, "StorageUnavailableError", { enumerable: true, get: function () { return fileStorage_js_1.StorageUnavailableError; } });
/**
 * Record vault — the only place plaintext medical files are encrypted or decrypted.
 *
 * Upload:   SHA-256(plaintext) → fingerprint anchored on the blockchain
 *           random 256-bit data key → AES-256-GCM(plaintext, AAD = record id + patient id)
 *           data key wrapped by the master key → stored with the record
 *           ciphertext → GridFS (or the local encrypted-files folder)
 * Download: SHA-256(ciphertext) must match → unwrap data key → GCM decrypt (fails if a single
 *           byte changed) → SHA-256(plaintext) must equal the anchored fingerprint.
 */
class IntegrityError extends Error {
    stage;
    constructor(message, stage) {
        super(message);
        this.stage = stage;
    }
}
exports.IntegrityError = IntegrityError;
class FileNotStoredError extends Error {
}
exports.FileNotStoredError = FileNotStoredError;
class KeyUnavailableError extends Error {
}
exports.KeyUnavailableError = KeyUnavailableError;
const fileAad = (reportId, patientId) => `medledger-file:v1:${reportId}:${patientId}`;
const keyContext = (reportId) => `file:${reportId}`;
const sha256Hex = (data) => `0x${crypto_1.default.createHash('sha256').update(data).digest('hex')}`;
exports.sha256Hex = sha256Hex;
class RecordVault {
    /** Encrypts and stores a file. Nothing unencrypted is written anywhere. */
    async sealFile(reportId, patientId, plaintext) {
        const fileHash = (0, exports.sha256Hex)(plaintext);
        const dek = keyService_js_1.keyService.newDataKey();
        try {
            const enc = encryptionService_js_1.encryptionService.encrypt(plaintext, dek, fileAad(reportId, patientId));
            const encryption = {
                algorithm: 'aes-256-gcm',
                version: 1,
                iv: enc.iv,
                authTag: enc.authTag,
                wrappedKey: keyService_js_1.keyService.wrap(dek, keyContext(reportId)),
                encryptedAt: new Date().toISOString()
            };
            const storage = await fileStorage_js_1.fileStorage.put(reportId, enc.encryptedData, { reportId, patientId });
            return { fileHash, encryption, storage };
        }
        finally {
            dek.fill(0);
        }
    }
    /** Loads, checks and decrypts a record's file. Throws IntegrityError on any mismatch. */
    async openFile(report) {
        const { encryption, storage } = report;
        if (!encryption || !storage) {
            throw new FileNotStoredError('The original file for this record was not kept (it was added before encrypted storage was enabled). Ask the uploader to upload it again.');
        }
        let ciphertext;
        try {
            ciphertext = await fileStorage_js_1.fileStorage.get(storage);
        }
        catch (err) {
            if (err instanceof fileStorage_js_1.StorageUnavailableError)
                throw err;
            throw new FileNotStoredError('The encrypted file for this record is missing from storage.');
        }
        if (fileStorage_js_1.fileStorage.checksum(ciphertext) !== storage.ciphertextSha256) {
            throw new IntegrityError('The stored encrypted file has been changed or corrupted.', 'ciphertext');
        }
        const keyId = keyService_js_1.keyService.keyIdOf(encryption.wrappedKey);
        if (!keyService_js_1.keyService.hasKey(keyId)) {
            throw new KeyUnavailableError(`The master key that protects this record (${keyId}) is not configured on this server. Add it to MASTER_ENCRYPTION_KEYS_PREVIOUS.`);
        }
        let dek;
        try {
            dek = keyService_js_1.keyService.unwrap(encryption.wrappedKey, keyContext(report.reportId));
        }
        catch {
            throw new IntegrityError('The record\'s encryption key does not belong to this record — its data has been altered.', 'decryption');
        }
        let plaintext;
        try {
            plaintext = encryptionService_js_1.encryptionService.decrypt(ciphertext, dek, encryption.iv, encryption.authTag, fileAad(report.reportId, report.patientId));
        }
        catch {
            throw new IntegrityError('Decryption failed: the file or its encryption data has been tampered with.', 'decryption');
        }
        finally {
            dek.fill(0);
        }
        if ((0, exports.sha256Hex)(plaintext).toLowerCase() !== String(report.fileHash).toLowerCase()) {
            throw new IntegrityError('The decrypted file does not match its SHA-256 fingerprint.', 'fingerprint');
        }
        return plaintext;
    }
    /** Runs every check without returning the file. */
    async verify(report) {
        const base = {
            reportId: report.reportId,
            fileStored: false,
            storageBackend: report.storage?.backend || null,
            ciphertextIntact: null,
            decrypts: null,
            fingerprintMatches: null,
            keyId: report.encryption ? keyService_js_1.keyService.keyIdOf(report.encryption.wrappedKey) : null,
            verified: false
        };
        try {
            await this.openFile(report);
            return { ...base, fileStored: true, ciphertextIntact: true, decrypts: true, fingerprintMatches: true, verified: true };
        }
        catch (err) {
            if (err instanceof IntegrityError) {
                return {
                    ...base,
                    fileStored: true,
                    ciphertextIntact: err.stage !== 'ciphertext',
                    decrypts: err.stage === 'ciphertext' ? null : err.stage !== 'decryption',
                    fingerprintMatches: err.stage === 'fingerprint' ? false : null,
                    problem: err.message
                };
            }
            return { ...base, problem: err.message };
        }
    }
    async discard(sealed) {
        if (sealed)
            await fileStorage_js_1.fileStorage.remove(sealed.storage);
    }
    // ---------- small text fields (clinical notes) ----------
    /** Encrypts a text field for storage at rest: n1|<wrapped key>|<base64(iv, tag, ciphertext)> */
    sealText(text, context) {
        const dek = keyService_js_1.keyService.newDataKey();
        try {
            const iv = crypto_1.default.randomBytes(12);
            const cipher = crypto_1.default.createCipheriv('aes-256-gcm', dek, iv);
            cipher.setAAD(Buffer.from(`medledger-text:${context}`, 'utf8'));
            const ct = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
            const wrapped = keyService_js_1.keyService.wrap(dek, `text:${context}`);
            return `n1|${wrapped}|${Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64')}`;
        }
        finally {
            dek.fill(0);
        }
    }
    openText(sealed, context) {
        const [version, wrapped, payload] = String(sealed).split('|');
        if (version !== 'n1' || !wrapped || !payload)
            throw new Error('Unsupported sealed text format.');
        const dek = keyService_js_1.keyService.unwrap(wrapped, `text:${context}`);
        try {
            const raw = Buffer.from(payload, 'base64');
            const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', dek, raw.subarray(0, 12));
            decipher.setAAD(Buffer.from(`medledger-text:${context}`, 'utf8'));
            decipher.setAuthTag(raw.subarray(12, 28));
            return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
        }
        finally {
            dek.fill(0);
        }
    }
    /** Re-wraps a sealed text's data key with the current master key (key rotation). */
    rewrapText(sealed, context) {
        const [version, wrapped, payload] = String(sealed).split('|');
        return `${version}|${keyService_js_1.keyService.rewrap(wrapped, `text:${context}`)}|${payload}`;
    }
    rewrapFileKey(report) {
        if (!report.encryption)
            return undefined;
        return { ...report.encryption, wrappedKey: keyService_js_1.keyService.rewrap(report.encryption.wrappedKey, keyContext(report.reportId)) };
    }
}
exports.recordVault = new RecordVault();
