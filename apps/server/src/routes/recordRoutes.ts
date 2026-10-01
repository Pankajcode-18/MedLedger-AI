import { Router } from 'express';
import { recordController } from '../controllers/recordController.js';
import { authMiddleware } from '../middleware/auth.js';
import { singleUpload } from '../middleware/upload.js';

const router = Router();

router.get('/', authMiddleware(), (req, res) => recordController.getRecords(req, res));
router.get('/storage/status', authMiddleware(['admin', 'system-admin']), (req, res) => recordController.storageStatus(req, res));
router.post('/upload', authMiddleware(), singleUpload('file'), (req, res) => recordController.uploadRecord(req, res));
router.get('/:id/download', authMiddleware(), (req, res) => recordController.downloadRecord(req, res));
router.get('/:id/text', authMiddleware(), (req, res) => recordController.getRecordText(req, res));
router.put('/:id/text', authMiddleware(), (req, res) => recordController.correctRecordText(req, res));
router.post('/:id/extract', authMiddleware(), (req, res) => recordController.reextractRecord(req, res));
router.get('/:id/verify', authMiddleware(), (req, res) => recordController.verifyRecord(req, res));

export default router;
