"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const authController_js_1 = require("../controllers/authController.js");
const walletController_js_1 = require("../controllers/walletController.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
/**
 * IP-based throttle for credential endpoints (on in every environment).
 * Per-account lockout after repeated wrong passwords is handled in the controller.
 */
const credentialLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.AUTH_RATE_LIMIT || '30', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many attempts from this device. Please wait 15 minutes and try again.' }
});
router.post('/register', credentialLimiter, (req, res) => authController_js_1.authController.register(req, res));
router.post('/login', credentialLimiter, (req, res) => authController_js_1.authController.login(req, res));
router.post('/forgot-password', credentialLimiter, (req, res) => authController_js_1.authController.forgotPassword(req, res));
router.post('/reset-password', credentialLimiter, (req, res) => authController_js_1.authController.resetPassword(req, res));
// Sign in with MetaMask (a linked wallet signs a one-time message)
router.post('/wallet/challenge', credentialLimiter, (req, res) => walletController_js_1.walletController.loginChallenge(req, res));
router.post('/wallet/login', credentialLimiter, (req, res) => walletController_js_1.walletController.login(req, res));
router.get('/profile', (0, auth_js_1.authMiddleware)(), (req, res) => authController_js_1.authController.getProfile(req, res));
router.post('/logout', (0, auth_js_1.authMiddleware)(), (req, res) => authController_js_1.authController.logout(req, res));
router.get('/sessions', (0, auth_js_1.authMiddleware)(), (req, res) => authController_js_1.authController.listSessions(req, res));
router.post('/logout-others', (0, auth_js_1.authMiddleware)(), (req, res) => authController_js_1.authController.logoutOthers(req, res));
router.post('/change-password', (0, auth_js_1.authMiddleware)(), (req, res) => authController_js_1.authController.changePassword(req, res));
exports.default = router;
