import multer from 'multer';
import { NextFunction, Request, Response } from 'express';
import { config } from '../config/index.js';

/** Files are held in memory only long enough to be validated and encrypted — never written unencrypted. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.uploadMaxMb * 1024 * 1024,
    files: 1,
    fields: 20,
    fieldSize: 64 * 1024
  }
});

/** Single-file upload with friendly errors (413 for too large, 400 for malformed forms). */
export const singleUpload =
  (field: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    upload.single(field)(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ success: false, error: `The file is larger than the ${config.uploadMaxMb} MB limit.` });
          return;
        }
        res.status(400).json({ success: false, error: `Upload problem: ${err.message}.` });
        return;
      }
      next(err);
    });
  };
