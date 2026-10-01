"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const aiController_js_1 = require("../controllers/aiController.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
// Every AI call requires a signed-in user (protects patient data and the OpenAI API budget).
const signedIn = (0, auth_js_1.authMiddleware)();
const clinicians = (0, auth_js_1.authMiddleware)(['doctor', 'hospital', 'hospital-admin']);
const labStaff = (0, auth_js_1.authMiddleware)(['doctor', 'hospital', 'hospital-admin', 'lab']);
// Per-IP cap on AI requests so a single client cannot run up external API costs.
const aiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: parseInt(process.env.AI_RATE_LIMIT_PER_MIN || '30', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many AI requests. Please wait a minute and try again.' }
});
router.use(aiLimiter);
router.get('/status', signedIn, aiController_js_1.aiController.status);
// Patients and clinicians
router.post('/deidentify', signedIn, aiController_js_1.aiController.deidentifyPreview);
router.post('/summarize', signedIn, aiController_js_1.aiController.summarize);
router.post('/analyze', signedIn, aiController_js_1.aiController.analyze);
router.post('/drug', signedIn, aiController_js_1.aiController.checkDrugInteractions);
router.post('/drug-info', signedIn, aiController_js_1.aiController.drugInfo);
router.post('/trends', signedIn, aiController_js_1.aiController.trends);
router.post('/risk', signedIn, aiController_js_1.aiController.risk);
router.post('/chat', signedIn, aiController_js_1.aiController.chat);
router.get('/chat/history', signedIn, aiController_js_1.aiController.chatHistory);
router.delete('/chat/history', signedIn, aiController_js_1.aiController.clearChat);
// Clinician tools
router.post('/doctor/drug-interactions', clinicians, aiController_js_1.aiController.checkDrugInteractions);
router.post('/doctor/chart-synthesis', clinicians, aiController_js_1.aiController.chartSynthesis);
router.post('/doctor/lab-triage', labStaff, aiController_js_1.aiController.labTriage);
router.post('/doctor/soap-note', clinicians, aiController_js_1.aiController.soapNote);
exports.default = router;
