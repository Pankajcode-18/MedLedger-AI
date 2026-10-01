"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stateStore_js_1 = require("../models/stateStore.js");
const blockchainController_js_1 = require("../controllers/blockchainController.js");
const accessController_js_1 = require("../controllers/accessController.js");
const recordController_js_1 = require("../controllers/recordController.js");
const aiController_js_1 = require("../controllers/aiController.js");
const blockchainService_js_1 = require("../services/blockchainService.js");
const auditService_js_1 = require("../services/auditService.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
// Blocks
router.get('/getBlocks', (req, res) => blockchainController_js_1.blockchainController.getBlocks(req, res));
// Directory queries
router.get(['/patientdatas', '/getPatients'], (_req, res) => {
    const state = stateStore_js_1.stateStore.getState();
    res.status(200).json(state.patients);
});
router.get(['/doctordatas', '/getDoctors'], (_req, res) => {
    const state = stateStore_js_1.stateStore.getState();
    res.status(200).json(state.doctors);
});
router.get(['/reportdatas', '/getReports'], (0, auth_js_1.authMiddleware)(['hospital', 'hospital-admin']), (_req, res) => {
    const state = stateStore_js_1.stateStore.getState();
    res.status(200).json(state.reports.map(recordController_js_1.toPublicRecord));
});
// Registrations
router.post('/registerPatient', (0, auth_js_1.authMiddleware)(['hospital', 'hospital-admin']), async (req, res) => {
    const { patientId, name, email, age, phNo, adharNo, address, city } = req.body;
    const pId = patientId || `${Date.now()}`;
    const walletAddress = blockchainService_js_1.blockchainService.deriveAddress(pId);
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
        type: 'patient'
    };
    stateStore_js_1.stateStore.addPatient(newPatient);
    await auditService_js_1.auditService.logEvent({
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
router.post('/registerDoctor', (0, auth_js_1.authMiddleware)(['hospital', 'hospital-admin']), async (req, res) => {
    const { doctorId, name, email, age, phNo, licenseId } = req.body;
    const dId = doctorId || `${Date.now()}`;
    const walletAddress = blockchainService_js_1.blockchainService.deriveAddress(dId);
    const newDoctor = {
        doctorId: dId,
        name: name || 'Dr. New Clinician',
        email: email || `${dId}@hospital.com`,
        age: age || '40',
        phNo: phNo || '',
        licenseId: licenseId || 'DOC-LIC-999',
        ethereumAddress: walletAddress,
        type: 'doctor'
    };
    stateStore_js_1.stateStore.addDoctor(newDoctor);
    await auditService_js_1.auditService.logEvent({
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
router.post('/requestAccess', (0, auth_js_1.authMiddleware)(['doctor', 'hospital', 'hospital-admin']), (req, res) => accessController_js_1.accessController.requestAccess(req, res));
router.post('/grantAccess', (0, auth_js_1.authMiddleware)('patient'), (req, res) => accessController_js_1.accessController.grantAccess(req, res));
router.post('/rejectAccess', (0, auth_js_1.authMiddleware)('patient'), (req, res) => accessController_js_1.accessController.rejectAccess(req, res));
router.post('/revokeAccess', (0, auth_js_1.authMiddleware)('patient'), (req, res) => accessController_js_1.accessController.revokeAccess(req, res));
// Download
router.get('/downloadFile', (0, auth_js_1.authMiddleware)(), (req, res) => {
    const fileName = req.query.fileName || 'hp9.docx';
    req.params['id'] = fileName;
    recordController_js_1.recordController.downloadRecord(req, res);
});
// AI Summarize
router.post('/summarizeReport', (0, auth_js_1.authMiddleware)(), (req, res) => aiController_js_1.aiController.summarize(req, res));
exports.default = router;
