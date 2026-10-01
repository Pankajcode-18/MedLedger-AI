"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canReadPatientRecords = void 0;
const stateStore_js_1 = require("../models/stateStore.js");
const blockchainService_js_1 = require("./blockchainService.js");
const ADMIN = ['admin', 'system-admin'];
const CONSENT_ROLES = ['doctor', 'hospital', 'hospital-admin'];
/**
 * Can this user read a patient's health records?
 *  - patients: only their own
 *  - administrators: yes (audited)
 *  - doctors / hospitals: only after the patient has granted them access
 *  - labs / insurers: no (they work with the records they upload or are sent)
 */
const canReadPatientRecords = async (user, patientId) => {
    if (!user)
        return false;
    const uid = String(user.userId);
    if (user.role === 'patient')
        return uid === String(patientId);
    if (ADMIN.includes(user.role))
        return true;
    if (!CONSENT_ROLES.includes(user.role))
        return false;
    const reports = stateStore_js_1.stateStore.getState().reports.filter((r) => String(r.patientId) === String(patientId));
    const granted = reports.some((r) => r.authorizedUsers?.includes(uid) || (user.walletAddress && r.authorizedUsers?.includes(user.walletAddress)));
    if (granted)
        return true;
    return blockchainService_js_1.blockchainService.hasAccess(String(patientId), uid);
};
exports.canReadPatientRecords = canReadPatientRecords;
