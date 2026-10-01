import { Router } from 'express';
import { vitalsController } from '../controllers/vitalsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware(), (req, res) => vitalsController.list(req, res));
router.post('/', authMiddleware(), (req, res) => vitalsController.add(req, res));
router.delete('/:id', authMiddleware(), (req, res) => vitalsController.remove(req, res));

export default router;
