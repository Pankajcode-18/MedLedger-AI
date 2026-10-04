import { stateStore } from '../models/stateStore.js';
import { recordVault, sha256Hex } from './recordVault.js';
import { keyService } from './keyService.js';

/**
 * Brings records created before encrypted storage existed up to date (runs at start-up, idempotent).
 *  - Note-only uploads, whose SHA-256 fingerprint was calculated over the note text, are
 *    re-created as real encrypted files — the fingerprint still matches, so nothing changes on-chain.
 *  - Records whose original file was never kept are marked `legacy`; their download explains that
 *    instead of returning placeholder text.
 */
export const migrateLegacyRecords = async (): Promise<{ encrypted: number; markedLegacy: number }> => {
  let encrypted = 0;
  let markedLegacy = 0;
  for (const r of stateStore.getState().reports) {
    if (r.storage && r.encryption) continue;
    const text = r.report || '';
    if (text && sha256Hex(Buffer.from(text, 'utf8')).toLowerCase() === String(r.fileHash).toLowerCase()) {
      try {
        const sealed = await recordVault.sealFile(r.reportId, String(r.patientId), Buffer.from(text, 'utf8'));
        stateStore.updateReport(r.reportId, {
          encryption: sealed.encryption,
          storage: sealed.storage,
          fileType: 'text/plain; charset=utf-8',
          fileSize: Buffer.byteLength(text),
          legacy: false
        });
        encrypted++;
      } catch (err) {
        console.warn(`[Storage] Could not migrate record ${r.reportId}:`, (err as Error).message);
      }
    } else if (!r.legacy) {
      stateStore.updateReport(r.reportId, { legacy: true });
      markedLegacy++;
    }
  }
  if (encrypted || markedLegacy) {
    console.log(`[Storage] Migrated ${encrypted} older record(s) into encrypted storage; ${markedLegacy} have no original file.`);
  }
  return { encrypted, markedLegacy };
};

/**
 * Key rotation: after setting a new MASTER_ENCRYPTION_KEY (and moving the old one to
 * MASTER_ENCRYPTION_KEYS_PREVIOUS), re-wrap every data key with the new master key.
 * Files are not re-encrypted; only the small wrapped keys change.
 */
export const rotateMasterKey = async (): Promise<{ rewrappedFiles: number; resealedNotes: number; failed: string[]; currentKeyId: string }> => {
  let rewrappedFiles = 0;
  const failed: string[] = [];
  const current = keyService.currentKeyId;
  for (const r of stateStore.getState().reports) {
    if (!r.encryption || keyService.keyIdOf(r.encryption.wrappedKey) === current) continue;
    try {
      const encryption = recordVault.rewrapFileKey(r);
      if (encryption) {
        r.encryption = encryption;
        rewrappedFiles++;
      }
    } catch (err) {
      // a missing old key or altered record: leave it untouched and report it
      failed.push(r.reportId);
      console.warn(`[Keys] Could not re-wrap record ${r.reportId}:`, (err as Error).message);
    }
  }
  const resealedNotes = await stateStore.rewrapSealedNotes();
  return { rewrappedFiles, resealedNotes, failed, currentKeyId: current };
};
