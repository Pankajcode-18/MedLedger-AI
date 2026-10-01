"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rotateMasterKey = exports.migrateLegacyRecords = void 0;
const stateStore_js_1 = require("../models/stateStore.js");
const recordVault_js_1 = require("./recordVault.js");
const keyService_js_1 = require("./keyService.js");
/**
 * Brings records created before encrypted storage existed up to date (runs at start-up, idempotent).
 *  - Note-only uploads, whose SHA-256 fingerprint was calculated over the note text, are
 *    re-created as real encrypted files — the fingerprint still matches, so nothing changes on-chain.
 *  - Records whose original file was never kept are marked `legacy`; their download explains that
 *    instead of returning placeholder text.
 */
const migrateLegacyRecords = async () => {
    let encrypted = 0;
    let markedLegacy = 0;
    for (const r of stateStore_js_1.stateStore.getState().reports) {
        if (r.storage && r.encryption)
            continue;
        const text = r.report || '';
        if (text && (0, recordVault_js_1.sha256Hex)(Buffer.from(text, 'utf8')).toLowerCase() === String(r.fileHash).toLowerCase()) {
            try {
                const sealed = await recordVault_js_1.recordVault.sealFile(r.reportId, String(r.patientId), Buffer.from(text, 'utf8'));
                stateStore_js_1.stateStore.updateReport(r.reportId, {
                    encryption: sealed.encryption,
                    storage: sealed.storage,
                    fileType: 'text/plain; charset=utf-8',
                    fileSize: Buffer.byteLength(text),
                    legacy: false
                });
                encrypted++;
            }
            catch (err) {
                console.warn(`[Storage] Could not migrate record ${r.reportId}:`, err.message);
            }
        }
        else if (!r.legacy) {
            stateStore_js_1.stateStore.updateReport(r.reportId, { legacy: true });
            markedLegacy++;
        }
    }
    if (encrypted || markedLegacy) {
        console.log(`[Storage] Migrated ${encrypted} older record(s) into encrypted storage; ${markedLegacy} have no original file.`);
    }
    return { encrypted, markedLegacy };
};
exports.migrateLegacyRecords = migrateLegacyRecords;
/**
 * Key rotation: after setting a new MASTER_ENCRYPTION_KEY (and moving the old one to
 * MASTER_ENCRYPTION_KEYS_PREVIOUS), re-wrap every data key with the new master key.
 * Files are not re-encrypted; only the small wrapped keys change.
 */
const rotateMasterKey = () => {
    let rewrappedFiles = 0;
    const failed = [];
    const current = keyService_js_1.keyService.currentKeyId;
    for (const r of stateStore_js_1.stateStore.getState().reports) {
        if (!r.encryption || keyService_js_1.keyService.keyIdOf(r.encryption.wrappedKey) === current)
            continue;
        try {
            const encryption = recordVault_js_1.recordVault.rewrapFileKey(r);
            if (encryption) {
                r.encryption = encryption;
                rewrappedFiles++;
            }
        }
        catch (err) {
            // a missing old key or altered record: leave it untouched and report it
            failed.push(r.reportId);
            console.warn(`[Keys] Could not re-wrap record ${r.reportId}:`, err.message);
        }
    }
    const resealedNotes = stateStore_js_1.stateStore.rewrapSealedNotes();
    return { rewrappedFiles, resealedNotes, failed, currentKeyId: current };
};
exports.rotateMasterKey = rotateMasterKey;
