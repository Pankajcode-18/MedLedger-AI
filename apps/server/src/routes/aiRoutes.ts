import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { aiController } from '../controllers/aiController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Every AI call requires a signed-in user (protects patient data and the OpenAI API budget).
const signedIn = authMiddleware();
const clinicians = authMiddleware(['doctor', 'hospital', 'hospital-admin']);
const labStaff = authMiddleware(['doctor', 'hospital', 'hospital-admin', 'lab']);

// Per-IP cap on AI requests so a single client cannot run up external API costs.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.AI_RATE_LIMIT_PER_MIN || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many AI requests. Please wait a minute and try again.' }
});
router.use(aiLimiter);

router.get('/status', signedIn, aiController.status);

// Patients and clinicians
router.post('/deidentify', signedIn, aiController.deidentifyPreview);
router.post('/summarize', signedIn, aiController.summarize);
router.post('/analyze', signedIn, aiController.analyze);
router.post('/drug', signedIn, aiController.checkDrugInteractions);
router.post('/drug-info', signedIn, aiController.drugInfo);
router.post('/trends', signedIn, aiController.trends);
router.post('/risk', signedIn, aiController.risk);
router.post('/chat', signedIn, aiController.chat);
router.get('/chat/history', signedIn, aiController.chatHistory);
router.delete('/chat/history', signedIn, aiController.clearChat);

// Clinician tools
router.post('/doctor/drug-interactions', clinicians, aiController.checkDrugInteractions);
router.post('/doctor/chart-synthesis', clinicians, aiController.chartSynthesis);
router.post('/doctor/lab-triage', labStaff, aiController.labTriage);
router.post('/doctor/soap-note', clinicians, aiController.soapNote);

export default router;
