import { Response } from 'express';
import { z } from 'zod';
import { vitalsService, VitalValidationError, VITAL_SPECS } from '../services/vitalsService.js';
import { canReadPatientRecords } from '../services/accessPolicy.js';
import { auditService } from '../services/auditService.js';
import { AuthenticatedRequest, UserRole, VitalType } from '../types/index.js';

const CLINICIANS = ['doctor', 'hospital', 'hospital-admin'];
const ADMINS = ['admin', 'system-admin'];

const addSchema = z.object({
  patientId: z.string().max(64).optional(),
  type: z.enum(Object.keys(VITAL_SPECS) as [VitalType, ...VitalType[]]),
  value: z.coerce.number(),
  value2: z.coerce.number().optional(),
  unit: z.string().max(8).optional(),
  takenAt: z.string().max(40).optional(),
  note: z.string().max(200).optional()
});

/** Patients see and add their own readings; doctors and hospitals only with the patient's consent. */
const targetPatient = async (req: AuthenticatedRequest, requested?: string): Promise<string | null> => {
  const user = req.user;
  if (!user) return null;
  if (user.role === 'patient') return String(user.userId);
  const pid = String(requested || '');
  if (!pid) return null;
  return (await canReadPatientRecords(user, pid)) ? pid : null;
};

export const vitalsController = {
  /** GET /api/vitals?patientId= */
  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const pid = await targetPatient(req, req.query.patientId as string | undefined);
    if (!pid) {
      res.status(403).json({ success: false, error: "You do not have the patient's permission to see their readings." });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { readings: vitalsService.forPatient(pid), types: VITAL_SPECS } });
  },

  /** POST /api/vitals */
  async add(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      const reading = vitalsService.add({
        ...parsed.data,
        patientId: pid,
        origin: user.role === 'patient' ? 'home' : 'clinic',
        enteredBy: String(user.userId),
        enteredRole: user.role
      });
      await auditService.logEvent({
        patientId: pid,
        actorId: String(user.userId),
        actorRole: user.role as UserRole,
        action: 'VITAL_RECORDED',
        details: { type: reading.type, origin: reading.origin }
      });
      res.status(201).json({ success: true, data: reading });
    } catch (err) {
      if (err instanceof VitalValidationError) {
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      res.status(500).json({ success: false, error: 'The reading could not be saved.' });
    }
  },

  /** DELETE /api/vitals/:id — whoever entered it (or an admin) can remove a mistaken reading. */
  async remove(req: AuthenticatedRequest, res: Response): Promise<void> {
    const reading = vitalsService.find(req.params.id);
    if (!reading) {
      res.status(404).json({ success: false, error: 'Reading not found.' });
      return;
    }
    const uid = String(req.user?.userId || '');
    if (reading.enteredBy !== uid && !ADMINS.includes(req.user?.role || '')) {
      res.status(403).json({ success: false, error: 'Only the person who entered this reading can delete it.' });
      return;
    }
    vitalsService.remove(reading.id);
    await auditService.logEvent({
      patientId: reading.patientId,
      actorId: uid,
      actorRole: req.user?.role as UserRole,
      action: 'VITAL_DELETED',
      details: { type: reading.type }
    });
    res.status(200).json({ success: true });
  }
};
