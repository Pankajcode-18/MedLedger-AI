"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileStorage = exports.StorageUnavailableError = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const mongoose_1 = __importDefault(require("mongoose"));
const index_js_1 = require("../config/index.js");
class StorageUnavailableError extends Error {
}
exports.StorageUnavailableError = StorageUnavailableError;
const BUCKET = 'encryptedRecords';
const SAFE_NAME = /^[A-Za-z0-9_-]{1,80}\.enc$/;
const sha256 = (b) => crypto_1.default.createHash('sha256').update(b).digest('hex');
const mongoReady = () => mongoose_1.default.connection.readyState === 1 && !!mongoose_1.default.connection.db;
const bucket = () => new mongoose_1.default.mongo.GridFSBucket(mongoose_1.default.connection.db, { bucketName: BUCKET });
class FileStorage {
    /** Backend new files are written to right now. */
    get activeBackend() {
        if (index_js_1.config.fileStorageBackend === 'local')
            return 'local';
        if (index_js_1.config.fileStorageBackend === 'gridfs')
            return 'gridfs';
        return mongoReady() ? 'gridfs' : 'local';
    }
    async put(id, ciphertext, metadata = {}) {
        const backend = this.activeBackend;
        const ciphertextSha256 = sha256(ciphertext);
        if (backend === 'gridfs') {
            if (!mongoReady())
                throw new StorageUnavailableError('MongoDB is not connected, so the file cannot be stored in GridFS.');
            const stream = bucket().openUploadStream(`${id}.enc`, {
                metadata: { ...metadata, ciphertextSha256, encrypted: true }
            });
            await new Promise((resolve, reject) => {
                stream.once('finish', () => resolve());
                stream.once('error', reject);
                stream.end(ciphertext);
            });
            return { backend, ref: String(stream.id), size: ciphertext.length, ciphertextSha256 };
        }
        const name = `${id}.enc`;
        if (!SAFE_NAME.test(name))
            throw new Error('Invalid storage id.');
        fs_1.default.mkdirSync(index_js_1.config.fileStorageDir, { recursive: true, mode: 0o700 });
        const target = path_1.default.join(index_js_1.config.fileStorageDir, name);
        // write to a temp file first, then rename — a crash never leaves a half-written record
        const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
        fs_1.default.writeFileSync(tmp, ciphertext, { mode: 0o600 });
        fs_1.default.renameSync(tmp, target);
        return { backend, ref: name, size: ciphertext.length, ciphertextSha256 };
    }
    async get(blob) {
        if (blob.backend === 'gridfs') {
            if (!mongoReady()) {
                throw new StorageUnavailableError('This file is stored in MongoDB GridFS, which is not connected right now.');
            }
            const chunks = [];
            const stream = bucket().openDownloadStream(new mongoose_1.default.Types.ObjectId(blob.ref));
            return await new Promise((resolve, reject) => {
                stream.on('data', (c) => chunks.push(c));
                stream.once('end', () => resolve(Buffer.concat(chunks)));
                stream.once('error', reject);
            });
        }
        if (!SAFE_NAME.test(blob.ref))
            throw new Error('Invalid storage reference.');
        return fs_1.default.promises.readFile(path_1.default.join(index_js_1.config.fileStorageDir, blob.ref));
    }
    async exists(blob) {
        try {
            if (blob.backend === 'gridfs') {
                if (!mongoReady())
                    return false;
                return (await bucket().find({ _id: new mongoose_1.default.Types.ObjectId(blob.ref) }).limit(1).toArray()).length > 0;
            }
            return SAFE_NAME.test(blob.ref) && fs_1.default.existsSync(path_1.default.join(index_js_1.config.fileStorageDir, blob.ref));
        }
        catch {
            return false;
        }
    }
    async remove(blob) {
        try {
            if (blob.backend === 'gridfs') {
                if (mongoReady())
                    await bucket().delete(new mongoose_1.default.Types.ObjectId(blob.ref));
                return;
            }
            if (SAFE_NAME.test(blob.ref))
                await fs_1.default.promises.rm(path_1.default.join(index_js_1.config.fileStorageDir, blob.ref), { force: true });
        }
        catch (err) {
            console.warn('[FileStorage] Could not remove stored file:', err.message);
        }
    }
    checksum(buffer) {
        return sha256(buffer);
    }
}
exports.fileStorage = new FileStorage();
