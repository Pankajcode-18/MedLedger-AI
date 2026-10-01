"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vitalsController = void 0;
const zod_1 = require("zod");
const vitalsService_js_1 = require("../services/vitalsService.js");
const accessPolicy_js_1 = require("../services/accessPolicy.js");
const auditService_js_1 = require("../services/auditService.js");
const CLINICIANS = ['doctor', 'hospital', 'hospital-admin'];
const ADMINS = ['admin', 'system-admin'];
const addSchema = zod_1.z.object({
    patientId: zod_1.z.string().max(64).optional(),
    type: zod_1.z.enum(Object.keys(vitalsService_js_1.VITAL_SPECS)),
    value: zod_1.z.coerce.number(),
    value2: zod_1.z.coerce.number().optional(),
    unit: zod_1.z.string().max(8).optional(),
    takenAt: zod_1.z.string().max(40).optional(),
    note: zod_1.z.string().max(200).optional()
});
/** Patients see and add their own readings; doctors and hospitals only with the patient's consent. */
const targetPatient = async (req, requested) => {
    const user = req.user;
    if (!user)
        return null;
    if (user.role === 'patient')
        return String(user.userId);
    const pid = String(requested || '');
    if (!pid)
        return null;
    return (await (0, accessPolicy_js_1.canReadPatientRecords)(user, pid)) ? pid : null;
};
exports.vitalsController = {
    /** GET /api/vitals?patientId= */
    async list(req, res) {
        const pid = await targetPatient(req, req.query.patientId);
        if (!pid) {
            res.status(403).json({ success: false, error: "You do not have the patient's permission to see their readings." });
            return;
        }
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ success: true, data: { readings: vitalsService_js_1.vitalsService.forPatient(pid), types: vitalsService_js_1.VITAL_SPECS } });
    },
    /** POST /api/vitals */
    async add(req, res) {
        const parsed = addSchema.safeParse(req.body || {});
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid reading.' });
            return;
        }
        const user = req.user;
        if (!user || !(user.role === 'patient' || CLINICIANS.includes(user.role))) {
            res.status(403).json({ success: false, error: 'Only patients and their doctors can record readings.' });
            return;
        }
        const pid = await targetPatient(req, parsed.data.patientId);
        if (!pid) {
            res.status(403).json({ success: false, error: "You do not have the patient's permission to add readings." });
            return;
        }
        try {
            const reading = vitalsService_js_1.vitalsService.add({
                ...parsed.data,
                patientId: pid,
                origin: user.role === 'patient' ? 'home' : 'clinic',
                enteredBy: String(user.userId),
                enteredRole: user.role
            });
            await auditService_js_1.auditService.logEvent({
                patientId: pid,
                actorId: String(user.userId),
                actorRole: user.role,
                action: 'VITAL_RECORDED',
                details: { type: reading.type, origin: reading.origin }
            });
            res.status(201).json({ success: true, data: reading });
        }
        catch (err) {
            if (err instanceof vitalsService_js_1.VitalValidationError) {
                res.status(400).json({ success: false, error: err.message });
                return;
            }
            res.status(500).json({ success: false, error: 'The reading could not be saved.' });
        }
    },
    /** DELETE /api/vitals/:id — whoever entered it (or an admin) can remove a mistaken reading. */
    async remove(req, res) {
        const reading = vitalsService_js_1.vitalsService.find(req.params.id);
        if (!reading) {
            res.status(404).json({ success: false, error: 'Reading not found.' });
            return;
        }
        const uid = String(req.user?.userId || '');
        if (reading.enteredBy !== uid && !ADMINS.includes(req.user?.role || '')) {
            res.status(403).json({ success: false, error: 'Only the person who entered this reading can delete it.' });
            return;
        }
        vitalsService_js_1.vitalsService.remove(reading.id);
        await auditService_js_1.auditService.logEvent({
            patientId: reading.patientId,
            actorId: uid,
            actorRole: req.user?.role,
            action: 'VITAL_DELETED',
            details: { type: reading.type }
        });
        res.status(200).json({ success: true });
    }
};
