import { Router } from 'express';
import { blockchainController } from '../controllers/blockchainController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// the full history names patients and doctors by ID, so only administrators may read it
router.get('/blocks', authMiddleware(['admin']), (req, res) => blockchainController.getBlocks(req, res));
router.get('/status', authMiddleware(['admin']), (req, res) => blockchainController.getStatus(req, res));
router.get('/verify/:sha256Hash', (req, res) => blockchainController.verifyRecord(req, res));
router.get('/verify', (req, res) => blockchainController.verifyRecord(req, res));
router.post('/verify', (req, res) => blockchainController.verifyRecord(req, res));

export default router;
