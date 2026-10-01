import crypto from 'crypto';
import { encryptionService } from './encryptionService.js';
import { keyService } from './keyService.js';
import { fileStorage, StoredBlob, StorageUnavailableError } from './fileStorage.js';
import { IMedicalReport, IRecordEncryption } from '../types/index.js';

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

export class IntegrityError extends Error {
  constructor(message: string, public stage: 'ciphertext' | 'decryption' | 'fingerprint') {
    super(message);
  }
}
export class FileNotStoredError extends Error {}
export class KeyUnavailableError extends Error {}
export { StorageUnavailableError };

const fileAad = (reportId: string, patientId: string): string => `medledger-file:v1:${reportId}:${patientId}`;
const keyContext = (reportId: string): string => `file:${reportId}`;

export const sha256Hex = (data: Buffer | string): string => `0x${crypto.createHash('sha256').update(data).digest('hex')}`;

/**
 * Files from this size are hashed, encrypted and decrypted with Web Crypto, which runs on libuv's
 * thread pool instead of the main thread: a 5 MB download no longer blocks every other request for
 * the ~40 ms its three passes take, and several downloads use several cores. Same algorithms, same bytes.
 */
export const OFF_THREAD_FROM = 1024 * 1024;
const subtle = crypto.webcrypto.subtle;

const sha256HexAsync = async (data: Buffer): Promise<string> =>
  data.length >= OFF_THREAD_FROM ? Buffer.from(await subtle.digest('SHA-256', data)).toString('hex') : crypto.createHash('sha256').update(data).digest('hex');

const encryptFile = async (plaintext: Buffer, dek: Buffer, aad: string): Promise<{ encryptedData: Buffer; iv: string; authTag: string }> => {
  if (plaintext.length < OFF_THREAD_FROM) return encryptionService.encrypt(plaintext, dek, aad);
  const iv = crypto.randomBytes(12);
  const key = await subtle.importKey('raw', dek, 'AES-GCM', false, ['encrypt']);
  const out = Buffer.from(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: Buffer.from(aad, 'utf8'), tagLength: 128 }, key, plaintext));
  // Web Crypto returns ciphertext || tag; stored separately exactly as the synchronous path does
  return { encryptedData: out.subarray(0, out.length - 16), iv: iv.toString('hex'), authTag: out.subarray(out.length - 16).toString('hex') };
};

const decryptFile = async (ciphertext: Buffer, dek: Buffer, ivHex: string, tagHex: string, aad: string): Promise<Buffer> => {
  if (ciphertext.length < OFF_THREAD_FROM) return encryptionService.decrypt(ciphertext, dek, ivHex, tagHex, aad);
  const key = await subtle.importKey('raw', dek, 'AES-GCM', false, ['decrypt']);
  const tag = Buffer.from(tagHex, 'hex');
  if (tag.length !== 16) throw new Error('Invalid authentication tag length.');
  return Buffer.from(
    await subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(ivHex, 'hex'), additionalData: Buffer.from(aad, 'utf8'), tagLength: 128 },
      key,
      Buffer.concat([ciphertext, tag])
    )
  );
};

export interface SealedFile {
  fileHash: string;
  encryption: IRecordEncryption;
  storage: StoredBlob;
}

export interface IntegrityReport {
  reportId: string;
  fileStored: boolean;
  storageBackend: string | null;
  ciphertextIntact: boolean | null;
  decrypts: boolean | null;
  fingerprintMatches: boolean | null;
  keyId: string | null;
  verified: boolean;
  problem?: string;
}

class RecordVault {
  /** Encrypts and stores a file. Nothing unencrypted is written anywhere. */
  public async sealFile(reportId: string, patientId: string, plaintext: Buffer): Promise<SealedFile> {
    const fileHash = `0x${await sha256HexAsync(plaintext)}`;
    const dek = keyService.newDataKey();
    try {
      const enc = await encryptFile(plaintext, dek, fileAad(reportId, patientId));
      const encryption: IRecordEncryption = {
        algorithm: 'aes-256-gcm',
        version: 1,
        iv: enc.iv,
        authTag: enc.authTag,
        wrappedKey: keyService.wrap(dek, keyContext(reportId)),
        encryptedAt: new Date().toISOString()
      };
      const storage = await fileStorage.put(reportId, enc.encryptedData, { reportId, patientId });
      return { fileHash, encryption, storage };
    } finally {
      dek.fill(0);
    }
  }

  /** Loads, checks and decrypts a record's file. Throws IntegrityError on any mismatch. */
  public async openFile(report: IMedicalReport): Promise<Buffer> {
    const { encryption, storage } = report;
    if (!encryption || !storage) {
      throw new FileNotStoredError(
        'The original file for this record was not kept (it was added before encrypted storage was enabled). Ask the uploader to upload it again.'
      );
    }

    let ciphertext: Buffer;
    try {
      ciphertext = await fileStorage.get(storage);
    } catch (err) {
      if (err instanceof StorageUnavailableError) throw err;
      throw new FileNotStoredError('The encrypted file for this record is missing from storage.');
    }

    // the stored checksum and the decryption run at the same time (both off the main thread for large
    // files); the checksum is still judged first, so the reported cause is the same as before
    const checksum = sha256HexAsync(ciphertext);
    const keyId = keyService.keyIdOf(encryption.wrappedKey);
    if (!keyService.hasKey(keyId)) {
      if ((await checksum) !== storage.ciphertextSha256) {
        throw new IntegrityError('The stored encrypted file has been changed or corrupted.', 'ciphertext');
      }
      throw new KeyUnavailableError(
        `The master key that protects this record (${keyId}) is not configured on this server. Add it to MASTER_ENCRYPTION_KEYS_PREVIOUS.`
      );
    }
    let dek: Buffer | null = null;
    let unwrapFailed = false;
    try {
      dek = keyService.unwrap(encryption.wrappedKey, keyContext(report.reportId));
    } catch {
      unwrapFailed = true;
    }
    const decrypted: Promise<Buffer | null> = dek
      ? decryptFile(ciphertext, dek, encryption.iv, encryption.authTag, fileAad(report.reportId, report.patientId)).catch(() => null)
      : Promise.resolve(null);
    const [sum, plain] = await Promise.all([checksum, decrypted]);
    if (dek) dek.fill(0);

    if (sum !== storage.ciphertextSha256) {
      throw new IntegrityError('The stored encrypted file has been changed or corrupted.', 'ciphertext');
    }
    if (unwrapFailed) {
      throw new IntegrityError('The record\'s encryption key does not belong to this record — its data has been altered.', 'decryption');
    }
    if (!plain) {
      throw new IntegrityError('Decryption failed: the file or its encryption data has been tampered with.', 'decryption');
    }
    const plaintext = plain;

    if (`0x${await sha256HexAsync(plaintext)}` !== String(report.fileHash).toLowerCase()) {
      throw new IntegrityError('The decrypted file does not match its SHA-256 fingerprint.', 'fingerprint');
    }
    return plaintext;
  }

  /** Runs every check without returning the file. */
  public async verify(report: IMedicalReport): Promise<IntegrityReport> {
    const base: IntegrityReport = {
      reportId: report.reportId,
      fileStored: false,
      storageBackend: report.storage?.backend || null,
      ciphertextIntact: null,
      decrypts: null,
      fingerprintMatches: null,
      keyId: report.encryption ? keyService.keyIdOf(report.encryption.wrappedKey) : null,
      verified: false
    };
    try {
      await this.openFile(report);
      return { ...base, fileStored: true, ciphertextIntact: true, decrypts: true, fingerprintMatches: true, verified: true };
    } catch (err) {
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
      return { ...base, problem: (err as Error).message };
    }
  }

  public async discard(sealed: SealedFile | undefined): Promise<void> {
    if (sealed) await fileStorage.remove(sealed.storage);
  }

  // ---------- small text fields (clinical notes) ----------

  /** Encrypts a text field for storage at rest: n1|<wrapped key>|<base64(iv, tag, ciphertext)> */
  public sealText(text: string, context: string): string {
    const dek = keyService.newDataKey();
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
      cipher.setAAD(Buffer.from(`medledger-text:${context}`, 'utf8'));
      const ct = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
      const wrapped = keyService.wrap(dek, `text:${context}`);
      return `n1|${wrapped}|${Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64')}`;
    } finally {
      dek.fill(0);
    }
  }

  public openText(sealed: string, context: string): string {
    const [version, wrapped, payload] = String(sealed).split('|');
    if (version !== 'n1' || !wrapped || !payload) throw new Error('Unsupported sealed text format.');
    const dek = keyService.unwrap(wrapped, `text:${context}`);
    try {
      const raw = Buffer.from(payload, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', dek, raw.subarray(0, 12));
      decipher.setAAD(Buffer.from(`medledger-text:${context}`, 'utf8'));
      decipher.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
    } finally {
      dek.fill(0);
    }
  }

  /** Re-wraps a sealed text's data key with the current master key (key rotation). */
  public rewrapText(sealed: string, context: string): string {
    const [version, wrapped, payload] = String(sealed).split('|');
    return `${version}|${keyService.rewrap(wrapped, `text:${context}`)}|${payload}`;
  }

  public rewrapFileKey(report: IMedicalReport): IRecordEncryption | undefined {
    if (!report.encryption) return undefined;
    return { ...report.encryption, wrappedKey: keyService.rewrap(report.encryption.wrappedKey, keyContext(report.reportId)) };
  }
}

export const recordVault = new RecordVault();
