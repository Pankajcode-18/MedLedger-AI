'use strict';

const crypto = require('crypto');

/**
 * AES-256-GCM File Encryption Service
 * Built with native Node.js crypto module (zero external dependencies).
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes (96-bit) recommended for GCM
const KEY_LENGTH = 32; // 32 bytes (256-bit)

/**
 * Helper to normalize key input to a 32-byte Buffer.
 * Supports 64-char hex string, 32-byte Buffer, or utf8 string.
 */
function normalizeKey(userEncryptionKey) {
  if (!userEncryptionKey) {
    throw new Error('User encryption key is required for AES-256-GCM operation.');
  }

  if (Buffer.isBuffer(userEncryptionKey)) {
    if (userEncryptionKey.length !== KEY_LENGTH) {
      throw new Error(`Encryption key Buffer must be exactly ${KEY_LENGTH} bytes. Received: ${userEncryptionKey.length}`);
    }
    return userEncryptionKey;
  }

  if (typeof userEncryptionKey === 'string') {
    // Check if valid 64-char hex string
    if (/^[0-9a-fA-F]{64}$/.test(userEncryptionKey)) {
      return Buffer.from(userEncryptionKey, 'hex');
    }
    // Otherwise derive 32-byte key using sha256 of the string
    return crypto.createHash('sha256').update(userEncryptionKey, 'utf8').digest();
  }

  throw new Error('Invalid user encryption key format. Expected 64-character hex string or 32-byte Buffer.');
}

/**
 * Helper to normalize input data to Buffer
 */
function normalizeBuffer(data) {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (typeof data === 'string') {
    return Buffer.from(data, 'utf8');
  }
  throw new Error('Input must be a Buffer or string.');
}

/**
 * Encrypt a file buffer using AES-256-GCM.
 * @param {Buffer|string} fileBuffer - Original file content
 * @param {string|Buffer} userEncryptionKey - 256-bit user key
 * @returns {{ encryptedData: Buffer, iv: string, authTag: string }}
 */
function encryptFile(fileBuffer, userEncryptionKey) {
  const buf = normalizeBuffer(fileBuffer);
  const key = normalizeKey(userEncryptionKey);

  // Generate 12-byte random IV using crypto.randomBytes(12)
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher: crypto.createCipheriv('aes-256-gcm', key, iv)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt: Buffer.concat([cipher.update(fileBuffer), cipher.final()])
  const encryptedData = Buffer.concat([cipher.update(buf), cipher.final()]);

  // Get authTag: cipher.getAuthTag()
  const authTag = cipher.getAuthTag();

  return {
    encryptedData,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt an encrypted file buffer using AES-256-GCM.
 * @param {Buffer|string} encryptedData - Encrypted bytes or hex string
 * @param {string|Buffer} iv - 12-byte IV in hex string or Buffer
 * @param {string|Buffer} authTag - 16-byte authentication tag in hex string or Buffer
 * @param {string|Buffer} userEncryptionKey - 256-bit user key
 * @returns {Buffer} Original decrypted buffer
 * @throws {Error} If authentication tag verification fails (tamper detected)
 */
function decryptFile(encryptedData, iv, authTag, userEncryptionKey) {
  const key = normalizeKey(userEncryptionKey);
  const ivBuf = Buffer.isBuffer(iv) ? iv : Buffer.from(iv, 'hex');
  const tagBuf = Buffer.isBuffer(authTag) ? authTag : Buffer.from(authTag, 'hex');
  const dataBuf = Buffer.isBuffer(encryptedData) ? encryptedData : Buffer.from(encryptedData, 'hex');

  if (ivBuf.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length. Expected ${IV_LENGTH} bytes, got ${ivBuf.length}.`);
  }

  // Create decipher with iv and key
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuf);

  // decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  decipher.setAuthTag(tagBuf);

  try {
    // Decrypt and return original buffer
    const decrypted = Buffer.concat([decipher.update(dataBuf), decipher.final()]);
    return decrypted;
  } catch (err) {
    // If authTag fails → throw error (tamper detected)
    const tamperError = new Error('Decryption failed: Authentication tag mismatch (Tampering detected or corrupt payload).');
    tamperError.code = 'INTEGRITY_TAMPER_DETECTED';
    tamperError.originalError = err.message;
    throw tamperError;
  }
}

/**
 * Generate a cryptographically secure 256-bit random user key.
 * @returns {string} 64-character hex string
 */
function generateUserKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Calculate the SHA-256 hash of a file buffer.
 * @param {Buffer|string} fileBuffer
 * @returns {string} 64-character hex string (SHA-256)
 */
function hashFile(fileBuffer) {
  const buf = normalizeBuffer(fileBuffer);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

module.exports = {
  encryptFile,
  decryptFile,
  generateUserKey,
  hashFile,
  ALGORITHM,
  IV_LENGTH,
  KEY_LENGTH
};
