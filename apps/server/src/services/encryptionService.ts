import crypto from 'crypto';

export interface EncryptedPayload {
  encryptedData: Buffer;
  iv: string;
  authTag: string;
}

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';

  /**
   * Generates a secure random 256-bit (32-byte) hex encryption key.
   */
  public generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Calculates SHA-256 hash of a buffer or string. Returns 0x-prefixed hex string.
   */
  public calculateSHA256(data: Buffer | string): string {
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return hash.startsWith('0x') ? hash : `0x${hash}`;
  }

  /**
   * Encrypts a buffer using AES-256-GCM.
   */
  public encrypt(data: Buffer, keyHex: string | Buffer, aad?: string): EncryptedPayload {
    const key = Buffer.isBuffer(keyHex) ? keyHex : Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
      throw new Error('Encryption key must be exactly 32 bytes (64 hex characters).');
    }
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    // Additional authenticated data binds the ciphertext to its record (swapping files is detected)
    if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));

    const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encryptedData,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypts an encrypted buffer using AES-256-GCM.
   */
  public decrypt(encryptedData: Buffer, keyHex: string | Buffer, ivHex: string, authTagHex: string, aad?: string): Buffer {
    const key = Buffer.isBuffer(keyHex) ? keyHex : Buffer.from(keyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  }
}

export const encryptionService = new EncryptionService();
