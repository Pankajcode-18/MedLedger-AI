import { Router } from 'express';
import { settingsController } from '../controllers/settingsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/:section', authMiddleware(), (req, res) => settingsController.get(req, res));
router.put('/:section', authMiddleware(), (req, res) => settingsController.save(req, res));

export default router;
