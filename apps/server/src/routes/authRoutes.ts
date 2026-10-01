import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/authController.js';
import { walletController } from '../controllers/walletController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/**
 * IP-based throttle for credential endpoints (on in every environment).
 * Per-account lockout after repeated wrong passwords is handled in the controller.
 */
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts from this device. Please wait 15 minutes and try again.' }
});

router.post('/register', credentialLimiter, (req, res) => authController.register(req, res));
router.post('/login', credentialLimiter, (req, res) => authController.login(req, res));
// "Try a demo": signs in to a sample account by role, only while DEMO_ACCOUNTS=true
router.post('/demo', credentialLimiter, (req, res) => authController.demoLogin(req, res));
router.post('/forgot-password', credentialLimiter, (req, res) => authController.forgotPassword(req, res));
router.post('/reset-password', credentialLimiter, (req, res) => authController.resetPassword(req, res));
// Sign in with MetaMask (a linked wallet signs a one-time message)
router.post('/wallet/challenge', credentialLimiter, (req, res) => walletController.loginChallenge(req, res));
router.post('/wallet/login', credentialLimiter, (req, res) => walletController.login(req, res));

router.get('/profile', authMiddleware(), (req, res) => authController.getProfile(req, res));
router.post('/logout', authMiddleware(), (req, res) => authController.logout(req, res));
router.get('/sessions', authMiddleware(), (req, res) => authController.listSessions(req, res));
router.post('/logout-others', authMiddleware(), (req, res) => authController.logoutOthers(req, res));
router.post('/change-password', authMiddleware(), (req, res) => authController.changePassword(req, res));

export default router;
