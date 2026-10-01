"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptionService = exports.EncryptionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
class EncryptionService {
    algorithm = 'aes-256-gcm';
    /**
     * Generates a secure random 256-bit (32-byte) hex encryption key.
     */
    generateKey() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    /**
     * Calculates SHA-256 hash of a buffer or string. Returns 0x-prefixed hex string.
     */
    calculateSHA256(data) {
        const hash = crypto_1.default.createHash('sha256').update(data).digest('hex');
        return hash.startsWith('0x') ? hash : `0x${hash}`;
    }
    /**
     * Encrypts a buffer using AES-256-GCM.
     */
    encrypt(data, keyHex, aad) {
        const key = Buffer.isBuffer(keyHex) ? keyHex : Buffer.from(keyHex, 'hex');
        if (key.length !== 32) {
            throw new Error('Encryption key must be exactly 32 bytes (64 hex characters).');
        }
        const iv = crypto_1.default.randomBytes(12); // 96-bit IV recommended for GCM
        const cipher = crypto_1.default.createCipheriv(this.algorithm, key, iv);
        // Additional authenticated data binds the ciphertext to its record (swapping files is detected)
        if (aad)
            cipher.setAAD(Buffer.from(aad, 'utf8'));
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
    decrypt(encryptedData, keyHex, ivHex, authTagHex, aad) {
        const key = Buffer.isBuffer(keyHex) ? keyHex : Buffer.from(keyHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto_1.default.createDecipheriv(this.algorithm, key, iv);
        if (aad)
            decipher.setAAD(Buffer.from(aad, 'utf8'));
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    }
}
exports.EncryptionService = EncryptionService;
exports.encryptionService = new EncryptionService();
