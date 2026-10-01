"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consentService = void 0;
const stateStore_js_1 = require("../models/stateStore.js");
const blockchainService_js_1 = require("./blockchainService.js");
const auditService_js_1 = require("./auditService.js");
/** The one place patient → doctor access is granted or removed. */
exports.consentService = {
    async grant(patientId, doctorId, actor, evidence = { method: 'session' }) {
        for (const r of stateStore_js_1.stateStore.getState().reports) {
            if (r.patientId === patientId) {
                r.isAsked = '0';
                r.isGiven = '1';
                if (!r.authorizedUsers)
                    r.authorizedUsers = [];
                if (!r.authorizedUsers.includes(doctorId))
                    r.authorizedUsers.push(doctorId);
            }
        }
        stateStore_js_1.stateStore.saveState();
        const ledgerTx = await blockchainService_js_1.blockchainService.grantAccess(patientId, doctorId);
        await auditService_js_1.auditService.logEvent({
            patientId,
            actorId: actor.userId,
            actorRole: actor.role,
            action: 'ACCESS_GRANTED',
            blockchainEventHash: evidence.txHash || ledgerTx,
            details: { doctorId, patientId, consent: evidence }
        });
        return { ledgerTx };
    },
    async revoke(patientId, doctorId, actor, evidence = { method: 'session' }) {
        for (const r of stateStore_js_1.stateStore.getState().reports) {
            if (r.patientId === patientId) {
                r.isGiven = '0';
                r.isAsked = '0';
                if (r.authorizedUsers)
                    r.authorizedUsers = r.authorizedUsers.filter((id) => id !== doctorId);
            }
        }
        stateStore_js_1.stateStore.saveState();
        const ledgerTx = await blockchainService_js_1.blockchainService.revokeAccess(patientId, doctorId);
        await auditService_js_1.auditService.logEvent({
            patientId,
            actorId: actor.userId,
            actorRole: actor.role,
            action: 'ACCESS_REVOKED',
            blockchainEventHash: evidence.txHash || ledgerTx,
            details: { doctorId, patientId, consent: evidence }
        });
        return { ledgerTx };
    }
};
