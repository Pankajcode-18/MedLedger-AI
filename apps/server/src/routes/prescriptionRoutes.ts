import { Router } from 'express';
import { prescriptionController } from '../controllers/prescriptionController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware(), (req, res) => prescriptionController.list(req, res));
router.post('/', authMiddleware(), (req, res) => prescriptionController.create(req, res));
router.patch('/:id', authMiddleware(), (req, res) => prescriptionController.setStatus(req, res));

export default router;
