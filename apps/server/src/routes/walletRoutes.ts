import { Router } from 'express';
import { walletController } from '../controllers/walletController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/config', (req, res) => walletController.config(req, res));
router.get('/status', authMiddleware(), (req, res) => walletController.status(req, res));
router.post('/link/challenge', authMiddleware(), (req, res) => walletController.linkChallenge(req, res));
router.post('/link', authMiddleware(), (req, res) => walletController.link(req, res));
router.delete('/link', authMiddleware(), (req, res) => walletController.unlink(req, res));
router.post('/consent/prepare', authMiddleware('patient'), (req, res) => walletController.prepareConsent(req, res));
router.post('/consent', authMiddleware('patient'), (req, res) => walletController.submitConsent(req, res));
router.post('/consent/tx', authMiddleware('patient'), (req, res) => walletController.submitConsentTx(req, res));

export default router;
