"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.keyService = exports.keyFingerprint = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("../config/index.js");
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
const parseKey = (raw, source) => {
    const value = raw.trim();
    let key = null;
    if (/^(0x)?[0-9a-fA-F]{64}$/.test(value))
        key = Buffer.from(value.replace(/^0x/, ''), 'hex');
    else if (/^[A-Za-z0-9+/_-]{43}=?$/.test(value))
        key = Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (!key || key.length !== 32) {
        throw new Error(`[Keys] ${source} must be 32 bytes: 64 hex characters or 44 base64 characters.`);
    }
    return key;
};
const keyFingerprint = (key) => crypto_1.default.createHash('sha256').update(key).digest('hex').slice(0, 16);
exports.keyFingerprint = keyFingerprint;
class KeyService {
    current = null;
    ring = new Map();
    source = 'environment';
    /** Loads keys on first use, so importing this module never has side effects. */
    load() {
        if (this.current)
            return;
        let master;
        if (index_js_1.config.masterEncryptionKey) {
            master = parseKey(index_js_1.config.masterEncryptionKey, 'MASTER_ENCRYPTION_KEY');
            this.source = 'environment';
        }
        else if (index_js_1.config.isProduction) {
            throw new Error('[Keys] MASTER_ENCRYPTION_KEY is required in production. Generate one with: ' +
                'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
        }
        else {
            master = this.loadOrCreateKeyFile();
            this.source = 'key-file';
        }
        this.current = { id: (0, exports.keyFingerprint)(master), key: master };
        this.ring.set(this.current.id, master);
        for (const [i, raw] of index_js_1.config.previousMasterKeys.entries()) {
            const k = parseKey(raw, `MASTER_ENCRYPTION_KEYS_PREVIOUS[${i}]`);
            this.ring.set((0, exports.keyFingerprint)(k), k);
        }
    }
    /** Development only: keep one generated key in a private file so restarts can still decrypt. */
    loadOrCreateKeyFile() {
        const file = index_js_1.config.masterKeyFile;
        if (fs_1.default.existsSync(file))
            return parseKey(fs_1.default.readFileSync(file, 'utf8'), file);
        const key = crypto_1.default.randomBytes(32);
        fs_1.default.mkdirSync(path_1.default.dirname(file), { recursive: true });
        fs_1.default.writeFileSync(file, key.toString('hex') + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        if (index_js_1.config.nodeEnv !== 'test') {
            console.warn(`[Keys] No MASTER_ENCRYPTION_KEY set — generated a development key in ${file}. ` +
                'Keep this file private and back it up: without it, stored records cannot be decrypted. ' +
                'Set MASTER_ENCRYPTION_KEY for any real deployment.');
        }
        return key;
    }
    get currentKeyId() {
        this.load();
        return this.current.id;
    }
    hasKey(keyId) {
        this.load();
        return this.ring.has(keyId);
    }
    /** A fresh random 256-bit data key for one record. */
    newDataKey() {
        return crypto_1.default.randomBytes(32);
    }
    /**
     * Wraps a data key with the current master key (AES-256-GCM). `context` is bound as
     * additional authenticated data, so a wrapped key copied to another record will not unwrap.
     * Format: v1.<keyId>.<base64(iv | tag | ciphertext)>
     */
    wrap(dataKey, context) {
        this.load();
        const { id, key } = this.current;
        const iv = crypto_1.default.randomBytes(12);
        const cipher = crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
        cipher.setAAD(Buffer.from(`medledger-dek:${context}`, 'utf8'));
        const ct = Buffer.concat([cipher.update(dataKey), cipher.final()]);
        return `${WRAP_VERSION}.${id}.${Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64')}`;
    }
    unwrap(wrapped, context) {
        this.load();
        const [version, keyId, payload] = String(wrapped || '').split('.');
        if (version !== WRAP_VERSION || !keyId || !payload)
            throw new Error('Unsupported wrapped key format.');
        const key = this.ring.get(keyId);
        if (!key) {
            throw new Error(`The master key that protects this record (${keyId}) is not configured. Add it to MASTER_ENCRYPTION_KEYS_PREVIOUS.`);
        }
        const raw = Buffer.from(payload, 'base64');
        const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
        decipher.setAAD(Buffer.from(`medledger-dek:${context}`, 'utf8'));
        decipher.setAuthTag(raw.subarray(12, 28));
        return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    }
    /** Which master key wrapped this value (without unwrapping it). */
    keyIdOf(wrapped) {
        return String(wrapped || '').split('.')[1] || '';
    }
    /** Re-wraps a data key under the current master key (used by key rotation). */
    rewrap(wrapped, context) {
        const dek = this.unwrap(wrapped, context);
        try {
            return this.wrap(dek, context);
        }
        finally {
            dek.fill(0);
        }
    }
    /** For tests: forget loaded keys so changed configuration is picked up. */
    reset() {
        this.current = null;
        this.ring.clear();
    }
}
exports.keyService = new KeyService();
