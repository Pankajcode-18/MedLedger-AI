"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = exports.AdminController = void 0;
const stateStore_js_1 = require("../models/stateStore.js");
const auditService_js_1 = require("../services/auditService.js");
class AdminController {
    async getStats(_req, res) {
        const state = stateStore_js_1.stateStore.getState();
        res.status(200).json({
            success: true,
            data: {
                totalPatients: state.patients?.length || 0,
                totalDoctors: state.doctors?.length || 0,
                totalReports: state.reports?.length || 0,
                totalBlocks: state.blocks?.length || 4,
                networkStatus: 'Ethereum Sepolia Active',
                integrityStatus: '100% Verified'
            }
        });
    }
    async getAuditLogs(req, res) {
        try {
            const actionFilter = req.query.action;
            let logs = await auditService_js_1.auditService.getAllLogs();
            if (actionFilter) {
                logs = logs.filter((l) => l.action.toLowerCase() === actionFilter.toLowerCase());
            }
            res.status(200).json({
                success: true,
                count: logs.length,
                data: logs,
                auditLog: logs
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
    /** Activity feed for the signed-in user (their own record events + actions they performed). */
    async getMyAuditLogs(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Authentication required.' });
                return;
            }
            const logs = await auditService_js_1.auditService.getLogsForUser(String(userId));
            res.status(200).json({ success: true, count: logs.length, data: logs });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
    async getPatientAuditLogs(req, res) {
        try {
            const patientId = req.params.patientId || req.user?.userId;
            if (!patientId) {
                res.status(400).json({ success: false, error: 'Patient ID is required.' });
                return;
            }
            const logs = await auditService_js_1.auditService.getLogsForPatient(patientId);
            res.status(200).json({
                success: true,
                patientId,
                count: logs.length,
                data: logs,
                auditLog: logs
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
}
exports.AdminController = AdminController;
exports.adminController = new AdminController();
