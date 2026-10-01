"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accessController = exports.AccessController = void 0;
const stateStore_js_1 = require("../models/stateStore.js");
const blockchainService_js_1 = require("../services/blockchainService.js");
const consentService_js_1 = require("../services/consentService.js");
const auditService_js_1 = require("../services/auditService.js");
const index_js_1 = require("../validators/index.js");
class AccessController {
    async requestAccess(req, res) {
        try {
            const parsed = index_js_1.requestAccessSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
                return;
            }
            const { patientId } = parsed.data;
            const doctorId = parsed.data.doctorId || req.user?.userId || '1593418229676';
            const state = stateStore_js_1.stateStore.getState();
            // Mark reports for this patient as asked
            for (const r of state.reports) {
                if (r.patientId === patientId) {
                    r.isAsked = '1';
                }
            }
            stateStore_js_1.stateStore.saveState();
            await auditService_js_1.auditService.logEvent({
                patientId,
                actorId: doctorId,
                actorRole: (req.user?.role || 'doctor'),
                action: 'ACCESS_REQUESTED',
                details: { doctorId, patientId }
            });
            res.status(200).json({
                success: true,
                message: 'Access request notified to patient. Waiting for patient approval.',
                data: { patientId, doctorId, status: 'PENDING_APPROVAL' }
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
    async grantAccess(req, res) {
        try {
            const parsed = index_js_1.grantAccessSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
                return;
            }
            const { patientId } = parsed.data;
            const doctorId = parsed.data.doctorId || '1593418229676';
            const { ledgerTx: txHash } = await consentService_js_1.consentService.grant(patientId, doctorId, {
                userId: String(req.user?.userId || patientId),
                role: String(req.user?.role || 'patient')
            });
            res.status(200).json({
                success: true,
                message: 'Access permission successfully granted and verified on the blockchain.',
                data: { patientId, doctorId, status: 'GRANTED', blockchainTxHash: txHash }
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
    async rejectAccess(req, res) {
        try {
            const { patientId } = req.body;
            const state = stateStore_js_1.stateStore.getState();
            for (const r of state.reports) {
                if (r.patientId === patientId) {
                    r.isAsked = '0';
                }
            }
            stateStore_js_1.stateStore.saveState();
            await auditService_js_1.auditService.logEvent({
                patientId,
                actorId: req.user?.userId || patientId,
                actorRole: (req.user?.role || 'patient'),
                action: 'ACCESS_REJECTED',
                details: { patientId }
            });
            res.status(200).json({
                success: true,
                message: 'Access request declined.',
                data: { patientId, status: 'REJECTED' }
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
    async revokeAccess(req, res) {
        try {
            const parsed = index_js_1.revokeAccessSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
                return;
            }
            const { patientId } = parsed.data;
            const doctorId = parsed.data.doctorId || '1593418229676';
            const { ledgerTx: txHash } = await consentService_js_1.consentService.revoke(patientId, doctorId, {
                userId: String(req.user?.userId || patientId),
                role: String(req.user?.role || 'patient')
            });
            res.status(200).json({
                success: true,
                message: 'Access permission revoked. Clinician can no longer view this record.',
                data: { patientId, doctorId, status: 'REVOKED', blockchainTxHash: txHash }
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
    async getStatus(req, res) {
        const patientId = String(req.query.patientId || req.user?.userId || '90');
        const doctorId = String(req.query.doctorId || '1593418229676');
        const state = stateStore_js_1.stateStore.getState();
        const rep = state.reports.find((r) => r.patientId === patientId);
        const isAsked = rep ? rep.isAsked === '1' : false;
        const isGiven = rep ? rep.isGiven === '1' : false;
        const onChain = await blockchainService_js_1.blockchainService.hasAccess(patientId, doctorId);
        res.status(200).json({
            success: true,
            data: {
                patientId,
                doctorId,
                isAsked,
                isGiven: isGiven || onChain,
                status: isGiven || onChain ? 'GRANTED' : isAsked ? 'PENDING' : 'NO_REQUEST'
            }
        });
    }
}
exports.AccessController = AccessController;
exports.accessController = new AccessController();
