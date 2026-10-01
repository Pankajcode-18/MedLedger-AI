import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

/**
 * Envelope encryption key management.
 *
 *   master key (KEK, from MASTER_ENCRYPTION_KEY)  ──wraps──▶  one random data key (DEK) per record
 *
 * Only the wrapped DEK is stored next to a record, so a copy of the database or the file store
 * alone cannot decrypt anything. Rotating the master key only re-wraps the small DEKs; the
 * files themselves are never re-encrypted. Every master key is identified by a short fingerprint
 * (`keyId`), so records wrapped with an older key keep working while
 * MASTER_ENCRYPTION_KEYS_PREVIOUS still lists it.
 */

const WRAP_VERSION = 'v1';

const parseKey = (raw: string, source: string): Buffer => {
  const value = raw.trim();
  let key: Buffer | null = null;
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(value)) key = Buffer.from(value.replace(/^0x/, ''), 'hex');
  else if (/^[A-Za-z0-9+/_-]{43}=?$/.test(value)) key = Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (!key || key.length !== 32) {
    throw new Error(`[Keys] ${source} must be 32 bytes: 64 hex characters or 44 base64 characters.`);
  }
  return key;
};

export const keyFingerprint = (key: Buffer): string => crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);

class KeyService {
  private current: { id: string; key: Buffer } | null = null;
  private ring = new Map<string, Buffer>();
  public source: 'environment' | 'key-file' = 'environment';

  /** Loads keys on first use, so importing this module never has side effects. */
  private load(): void {
    if (this.current) return;

    let master: Buffer;
    if (config.masterEncryptionKey) {
      master = parseKey(config.masterEncryptionKey, 'MASTER_ENCRYPTION_KEY');
      this.source = 'environment';
    } else if (config.isProduction) {
      throw new Error(
        '[Keys] MASTER_ENCRYPTION_KEY is required in production. Generate one with: ' +
          'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    } else {
      master = this.loadOrCreateKeyFile();
      this.source = 'key-file';
    }

    this.current = { id: keyFingerprint(master), key: master };
    this.ring.set(this.current.id, master);
    for (const [i, raw] of config.previousMasterKeys.entries()) {
      const k = parseKey(raw, `MASTER_ENCRYPTION_KEYS_PREVIOUS[${i}]`);
      this.ring.set(keyFingerprint(k), k);
    }
  }

  /** Development only: keep one generated key in a private file so restarts can still decrypt. */
  private loadOrCreateKeyFile(): Buffer {
    const file = config.masterKeyFile;
    if (fs.existsSync(file)) return parseKey(fs.readFileSync(file, 'utf8'), file);

    const key = crypto.randomBytes(32);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, key.toString('hex') + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    if (config.nodeEnv !== 'test') {
      console.warn(
        `[Keys] No MASTER_ENCRYPTION_KEY set — generated a development key in ${file}. ` +
          'Keep this file private and back it up: without it, stored records cannot be decrypted. ' +
          'Set MASTER_ENCRYPTION_KEY for any real deployment.'
      );
    }
    return key;
  }

  public get currentKeyId(): string {
    this.load();
    return (this.current as { id: string }).id;
  }

  public hasKey(keyId: string): boolean {
    this.load();
    return this.ring.has(keyId);
  }

  /** A fresh random 256-bit data key for one record. */
  public newDataKey(): Buffer {
    return crypto.randomBytes(32);
  }

  /**
   * Wraps a data key with the current master key (AES-256-GCM). `context` is bound as
   * additional authenticated data, so a wrapped key copied to another record will not unwrap.
   * Format: v1.<keyId>.<base64(iv | tag | ciphertext)>
   */
  public wrap(dataKey: Buffer, context: string): string {
    this.load();
    const { id, key } = this.current as { id: string; key: Buffer };
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(`medledger-dek:${context}`, 'utf8'));
    const ct = Buffer.concat([cipher.update(dataKey), cipher.final()]);
    return `${WRAP_VERSION}.${id}.${Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64')}`;
  }

  public unwrap(wrapped: string, context: string): Buffer {
    this.load();
    const [version, keyId, payload] = String(wrapped || '').split('.');
    if (version !== WRAP_VERSION || !keyId || !payload) throw new Error('Unsupported wrapped key format.');
    const key = this.ring.get(keyId);
    if (!key) {
      throw new Error(
        `The master key that protects this record (${keyId}) is not configured. Add it to MASTER_ENCRYPTION_KEYS_PREVIOUS.`
      );
    }
    const raw = Buffer.from(payload, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(`medledger-dek:${context}`, 'utf8'));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
  }

  /** Which master key wrapped this value (without unwrapping it). */
  public keyIdOf(wrapped: string): string {
    return String(wrapped || '').split('.')[1] || '';
  }

  /** Re-wraps a data key under the current master key (used by key rotation). */
  public rewrap(wrapped: string, context: string): string {
    const dek = this.unwrap(wrapped, context);
    try {
      return this.wrap(dek, context);
    } finally {
      dek.fill(0);
    }
  }

  /** For tests: forget loaded keys so changed configuration is picked up. */
  public reset(): void {
    this.current = null;
    this.ring.clear();
  }
}

export const keyService = new KeyService();
