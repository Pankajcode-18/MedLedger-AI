"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditService = exports.AuditService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const AuditLog_js_1 = require("../models/AuditLog.js");
const stateStore_js_1 = require("../models/stateStore.js");
const blockchainService_js_1 = require("./blockchainService.js");
class AuditService {
    async logEvent(params) {
        const eventHash = params.blockchainEventHash ||
            blockchainService_js_1.blockchainService.calculateSHA256(`${params.action}-${Date.now()}-${Math.random()}`);
        const entry = {
            patientId: params.patientId || 'system',
            actorId: params.actorId || 'system',
            actorRole: params.actorRole || 'system',
            action: params.action || 'ACTION_LOGGED',
            timestamp: new Date(),
            blockchainEventHash: eventHash,
            details: params.details || {}
        };
        if (mongoose_1.default.connection.readyState === 1) {
            try {
                await AuditLog_js_1.AuditLog.create(entry);
            }
            catch (e) {
                console.warn('[AuditService] MongoDB log notice:', e.message);
            }
        }
        stateStore_js_1.stateStore.addAuditLog(entry);
        return entry;
    }
    async getLogsForPatient(patientId) {
        if (mongoose_1.default.connection.readyState === 1) {
            try {
                const found = await AuditLog_js_1.AuditLog.find({ patientId }).sort({ timestamp: -1 }).lean();
                if (found && found.length > 0)
                    return found;
            }
            catch (e) {
                // fallback to stateStore
            }
        }
        const state = stateStore_js_1.stateStore.getState();
        const logs = state.auditLogs || [];
        return logs.filter((l) => String(l.patientId) === String(patientId));
    }
    /** Every event where the user is either the patient concerned or the person who acted. */
    async getLogsForUser(userId) {
        const id = String(userId);
        if (mongoose_1.default.connection.readyState === 1) {
            try {
                const found = await AuditLog_js_1.AuditLog.find({ $or: [{ patientId: id }, { actorId: id }] })
                    .sort({ timestamp: -1 })
                    .limit(200)
                    .lean();
                if (found && found.length > 0)
                    return found;
            }
            catch (e) {
                // fallback to stateStore
            }
        }
        const state = stateStore_js_1.stateStore.getState();
        return (state.auditLogs || [])
            .filter((l) => String(l.patientId) === id || String(l.actorId) === id)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 200);
    }
    async getAllLogs() {
        if (mongoose_1.default.connection.readyState === 1) {
            try {
                const found = await AuditLog_js_1.AuditLog.find().sort({ timestamp: -1 }).limit(200).lean();
                if (found && found.length > 0)
                    return found;
            }
            catch (e) {
                // fallback
            }
        }
        const state = stateStore_js_1.stateStore.getState();
        return state.auditLogs || [];
    }
}
exports.AuditService = AuditService;
exports.auditService = new AuditService();
