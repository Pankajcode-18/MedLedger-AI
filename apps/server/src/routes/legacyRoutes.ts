import { Router } from 'express';
import { stateStore } from '../models/stateStore.js';
import { blockchainController } from '../controllers/blockchainController.js';
import { accessController } from '../controllers/accessController.js';
import { recordController, toPublicRecord, visibleReports } from '../controllers/recordController.js';
import { AuthenticatedRequest } from '../types/index.js';
import { aiController } from '../controllers/aiController.js';
import { blockchainService } from '../services/blockchainService.js';
import { auditService } from '../services/auditService.js';
import { authMiddleware } from '../middleware/auth.js';
import { directory } from '../services/directory.js';

const router = Router();

// Blocks
router.get('/getBlocks', authMiddleware(['admin']), (req, res) => blockchainController.getBlocks(req, res));

// Directory queries
// Patients are listed only to staff who need to pick a patient; never to other patients or the public.
router.get(['/patientdatas', '/getPatients'], authMiddleware(['doctor', 'hospital', 'hospital-admin', 'lab', 'insurance', 'admin', 'system-admin']), (_req, res) => {
  res.status(200).json(directory.patients());
});

// Any signed-in user may look up doctors (patients choose whom to share with).
router.get(['/doctordatas', '/getDoctors'], authMiddleware(), (_req, res) => {
  res.status(200).json(directory.doctors());
});

router.get(['/reportdatas', '/getReports'], authMiddleware(['hospital', 'hospital-admin']), (req, res) => {
  const state = stateStore.getState();
  res.status(200).json(visibleReports((req as AuthenticatedRequest).user, state.reports).map(toPublicRecord));
});

// Registrations
router.post('/registerPatient', authMiddleware(['hospital', 'hospital-admin']), async (req, res) => {
  const { patientId, name, email, age, phNo, adharNo, address, city } = req.body;
  const pId = patientId || `${Date.now()}`;
  const walletAddress = blockchainService.deriveAddress(pId);

  const newPatient = {
    patientId: pId,
    name: name || 'New Patient',
    email: email || `${pId}@gmail.com`,
    age: age || '30',
    phNo: phNo || '',
    adharNo: adharNo || '',
    address: address || '',
    city: city || '',
    ethereumAddress: walletAddress,
    type: 'patient' as const
  };

  stateStore.addPatient(newPatient);
  await auditService.logEvent({
    patientId: pId,
    actorId: pId,
    actorRole: 'patient',
    action: 'PATIENT_REGISTERED',
    details: { name, email }
  });

  res.status(201).json({
    success: true,
    message: 'Patient successfully registered.',
    data: newPatient
  });
});

router.post('/registerDoctor', authMiddleware(['hospital', 'hospital-admin']), async (req, res) => {
  const { doctorId, name, email, age, phNo, licenseId } = req.body;
  const dId = doctorId || `${Date.now()}`;
  const walletAddress = blockchainService.deriveAddress(dId);

  const newDoctor = {
    doctorId: dId,
    name: name || 'Dr. New Clinician',
    email: email || `${dId}@hospital.com`,
    age: age || '40',
    phNo: phNo || '',
    licenseId: licenseId || 'DOC-LIC-999',
    ethereumAddress: walletAddress,
    type: 'doctor' as const
  };

  stateStore.addDoctor(newDoctor);
  await auditService.logEvent({
    patientId: 'system',
    actorId: dId,
    actorRole: 'doctor',
    action: 'DOCTOR_REGISTERED',
    details: { name, email }
  });

  res.status(201).json({
    success: true,
    message: 'Doctor successfully registered.',
    data: newDoctor
  });
});

// Access
router.post('/requestAccess', authMiddleware(['doctor', 'hospital', 'hospital-admin']), (req, res) => accessController.requestAccess(req, res));
router.post('/grantAccess', authMiddleware('patient'), (req, res) => accessController.grantAccess(req, res));
router.post('/rejectAccess', authMiddleware('patient'), (req, res) => accessController.rejectAccess(req, res));
router.post('/revokeAccess', authMiddleware('patient'), (req, res) => accessController.revokeAccess(req, res));

// Download
router.get('/downloadFile', authMiddleware(), (req, res) => {
  const fileName = (req.query.fileName as string) || 'hp9.docx';
  (req.params as Record<string, string>)['id'] = fileName;
  recordController.downloadRecord(req, res);
});

// AI Summarize
router.post('/summarizeReport', authMiddleware(), (req, res) => aiController.summarize(req, res));

export default router;
