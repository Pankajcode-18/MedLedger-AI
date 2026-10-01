"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_js_1 = require("../controllers/adminController.js");
const authController_js_1 = require("../controllers/authController.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
router.get('/stats', (req, res) => adminController_js_1.adminController.getStats(req, res));
router.get('/all', (0, auth_js_1.authMiddleware)('admin'), (req, res) => adminController_js_1.adminController.getStats(req, res));
// Administrators create organisation / admin accounts (these roles cannot self-register)
router.get('/users', (0, auth_js_1.authMiddleware)('admin'), (req, res) => authController_js_1.authController.adminListUsers(req, res));
router.post('/users', (0, auth_js_1.authMiddleware)('admin'), (req, res) => authController_js_1.authController.adminCreateUser(req, res));
router.patch('/users/:userId/status', (0, auth_js_1.authMiddleware)('admin'), (req, res) => authController_js_1.authController.adminSetUserStatus(req, res));
router.get('/audit', (0, auth_js_1.authMiddleware)('admin'), (req, res) => adminController_js_1.adminController.getAuditLogs(req, res));
router.get('/audit/me', (0, auth_js_1.authMiddleware)(), (req, res) => adminController_js_1.adminController.getMyAuditLogs(req, res));
router.get('/audit/:patientId', (0, auth_js_1.authMiddleware)(), (req, res) => adminController_js_1.adminController.getPatientAuditLogs(req, res));
exports.default = router;
