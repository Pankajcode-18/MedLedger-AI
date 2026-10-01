import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { config } from '../config/index.js';

/**
 * Where encrypted record files live. Only ciphertext ever reaches this layer.
 *
 *  - "gridfs": MongoDB GridFS bucket `encryptedRecords` (Project Guide §5) — used whenever MongoDB is connected
 *  - "local":  one `<id>.enc` file per record in FILE_STORAGE_DIR — used when running without MongoDB
 *
 * Each record remembers which backend holds its file, so records written by either keep working.
 */

export type StorageBackend = 'gridfs' | 'local';

export interface StoredBlob {
  backend: StorageBackend;
  /** GridFS ObjectId (hex) or local file name */
  ref: string;
  /** size of the ciphertext in bytes */
  size: number;
  /** SHA-256 of the ciphertext — detects a corrupted or replaced file before decryption */
  ciphertextSha256: string;
}

export class StorageUnavailableError extends Error {}

const BUCKET = 'encryptedRecords';
const SAFE_NAME = /^[A-Za-z0-9_-]{1,80}\.enc$/;

const sha256 = (b: Buffer): string => crypto.createHash('sha256').update(b).digest('hex');

const mongoReady = (): boolean => mongoose.connection.readyState === 1 && !!mongoose.connection.db;

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db as mongoose.mongo.Db, { bucketName: BUCKET });

class FileStorage {
  /** Backend new files are written to right now. */
  public get activeBackend(): StorageBackend {
    if (config.fileStorageBackend === 'local') return 'local';
    if (config.fileStorageBackend === 'gridfs') return 'gridfs';
    return mongoReady() ? 'gridfs' : 'local';
  }

  public async put(id: string, ciphertext: Buffer, metadata: Record<string, string> = {}): Promise<StoredBlob> {
    const backend = this.activeBackend;
    // large files are hashed on the thread pool (Web Crypto) so uploads do not block other requests
    const ciphertextSha256 =
      ciphertext.length >= 1024 * 1024 ? Buffer.from(await crypto.webcrypto.subtle.digest('SHA-256', ciphertext)).toString('hex') : sha256(ciphertext);

    if (backend === 'gridfs') {
      if (!mongoReady()) throw new StorageUnavailableError('MongoDB is not connected, so the file cannot be stored in GridFS.');
      const stream = bucket().openUploadStream(`${id}.enc`, {
        metadata: { ...metadata, ciphertextSha256, encrypted: true }
      });
      await new Promise<void>((resolve, reject) => {
        stream.once('finish', () => resolve());
        stream.once('error', reject);
        stream.end(ciphertext);
      });
      return { backend, ref: String(stream.id), size: ciphertext.length, ciphertextSha256 };
    }

    const name = `${id}.enc`;
    if (!SAFE_NAME.test(name)) throw new Error('Invalid storage id.');
    fs.mkdirSync(config.fileStorageDir, { recursive: true, mode: 0o700 });
    const target = path.join(config.fileStorageDir, name);
    // write to a temp file first, then rename — a crash never leaves a half-written record
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.writeFile(tmp, ciphertext, { mode: 0o600 });
    await fs.promises.rename(tmp, target);
    return { backend, ref: name, size: ciphertext.length, ciphertextSha256 };
  }

  public async get(blob: StoredBlob): Promise<Buffer> {
    if (blob.backend === 'gridfs') {
      if (!mongoReady()) {
        throw new StorageUnavailableError('This file is stored in MongoDB GridFS, which is not connected right now.');
      }
      const chunks: Buffer[] = [];
      const stream = bucket().openDownloadStream(new mongoose.Types.ObjectId(blob.ref));
      return await new Promise<Buffer>((resolve, reject) => {
        stream.on('data', (c: Buffer) => chunks.push(c));
        stream.once('end', () => resolve(Buffer.concat(chunks)));
        stream.once('error', reject);
      });
    }
    if (!SAFE_NAME.test(blob.ref)) throw new Error('Invalid storage reference.');
    return fs.promises.readFile(path.join(config.fileStorageDir, blob.ref));
  }

  public async exists(blob: StoredBlob): Promise<boolean> {
    try {
      if (blob.backend === 'gridfs') {
        if (!mongoReady()) return false;
        return (await bucket().find({ _id: new mongoose.Types.ObjectId(blob.ref) }).limit(1).toArray()).length > 0;
      }
      return SAFE_NAME.test(blob.ref) && fs.existsSync(path.join(config.fileStorageDir, blob.ref));
    } catch {
      return false;
    }
  }

  public async remove(blob: StoredBlob): Promise<void> {
    try {
      if (blob.backend === 'gridfs') {
        if (mongoReady()) await bucket().delete(new mongoose.Types.ObjectId(blob.ref));
        return;
      }
      if (SAFE_NAME.test(blob.ref)) await fs.promises.rm(path.join(config.fileStorageDir, blob.ref), { force: true });
    } catch (err) {
      console.warn('[FileStorage] Could not remove stored file:', (err as Error).message);
    }
  }

  public checksum(buffer: Buffer): string {
    return sha256(buffer);
  }
}

export const fileStorage = new FileStorage();
