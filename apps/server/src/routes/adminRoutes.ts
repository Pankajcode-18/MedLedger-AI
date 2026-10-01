import { Router } from 'express';
import { adminController } from '../controllers/adminController.js';
import { authController } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/stats', authMiddleware('admin'), (req, res) => adminController.getStats(req, res));
router.get('/all', authMiddleware('admin'), (req, res) => adminController.getStats(req, res));
// Administrators create organisation / admin accounts (these roles cannot self-register)
router.get('/users', authMiddleware('admin'), (req, res) => authController.adminListUsers(req, res));
router.post('/users', authMiddleware('admin'), (req, res) => authController.adminCreateUser(req, res));
router.patch('/users/:userId/status', authMiddleware('admin'), (req, res) => authController.adminSetUserStatus(req, res));
router.get('/security', authMiddleware('admin'), (req, res) => adminController.getSecurity(req, res));
router.get('/audit', authMiddleware('admin'), (req, res) => adminController.getAuditLogs(req, res));
router.get('/audit/me', authMiddleware(), (req, res) => adminController.getMyAuditLogs(req, res));
router.get('/audit/:patientId', authMiddleware(), (req, res) =>
  adminController.getPatientAuditLogs(req, res)
);

export default router;
