import { Router } from 'express';
import { accessController } from '../controllers/accessController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/status', authMiddleware(), (req, res) => accessController.getStatus(req, res));
router.get('/doctors', authMiddleware(), (req, res) => accessController.searchDoctors(req, res));
router.post('/request', authMiddleware(), (req, res) => accessController.requestAccess(req, res));
router.post('/grant', authMiddleware(), (req, res) => accessController.grantAccess(req, res));
router.post(['/decline', '/reject'], authMiddleware(), (req, res) => accessController.rejectAccess(req, res));
router.post('/revoke', authMiddleware(), (req, res) => accessController.revokeAccess(req, res));

export default router;
