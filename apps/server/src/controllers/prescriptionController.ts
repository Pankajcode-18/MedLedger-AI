import crypto from 'crypto';
import { Response } from 'express';
import { z } from 'zod';
import { stateStore } from '../models/stateStore.js';
import { canReadPatientRecords } from '../services/accessPolicy.js';
import { auditService } from '../services/auditService.js';
import { userStore } from '../services/userStore.js';
import { orgCollections } from '../services/orgCollections.js';
import { AuthenticatedRequest, IPrescription, UserRole } from '../types/index.js';

const PRESCRIBERS = ['doctor', 'hospital', 'hospital-admin'];

const list = (): IPrescription[] => {
  const state = stateStore.getState();
  if (!state.prescriptions) state.prescriptions = [];
  return state.prescriptions;
};

const createSchema = z.object({
  patientId: z.string().min(1, 'Choose a patient.').max(64),
  drugName: z.string().trim().min(2, 'Enter the medicine name.').max(120),
  dosage: z.string().trim().min(1, 'Enter the dose (for example 500 mg).').max(60),
  frequency: z.string().trim().min(1, 'Enter how often to take it.').max(60),
  duration: z.string().trim().min(1, 'Enter for how long.').max(60),
  instructions: z.string().trim().max(300).optional()
});

const patientName = (patientId: string): string | undefined => {
  const p = stateStore.getState().patients.find((x) => String(x.patientId) === String(patientId));
  return p?.name;
};

export const prescriptionController = {
  /**
   * GET /api/prescriptions?patientId=
   * Patients see their own. Doctors see what they wrote, or one patient's list once that patient has shared records.
   */
  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Please sign in.' });
      return;
    }
    const uid = String(user.userId);
    const requested = req.query.patientId ? String(req.query.patientId) : '';
    let items: IPrescription[];
    if (user.role === 'patient') {
      items = list().filter((p) => p.patientId === uid);
    } else if (requested) {
      if (!(await canReadPatientRecords(user, requested))) {
        res.status(403).json({ success: false, error: "You do not have the patient's permission to see their medicines." });
        return;
      }
      items = list().filter((p) => p.patientId === requested);
    } else if (user.role === 'hospital-admin' || user.role === 'hospital') {
      // the hospital pharmacy sees medicines for patients currently admitted there
      const admitted = new Set(
        orgCollections
          .list('admissions', uid)
          .filter((a) => a.status !== 'Discharged' && a.patientId)
          .map((a) => String(a.patientId))
      );
      items = list().filter((p) => p.prescribedBy === uid || admitted.has(p.patientId));
    } else if (PRESCRIBERS.includes(user.role)) {
      items = list().filter((p) => p.prescribedBy === uid);
    } else {
      res.status(403).json({ success: false, error: 'Only patients and their doctors can see prescriptions.' });
      return;
    }
    items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: items });
  },

  /** POST /api/prescriptions */
  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user;
    if (!user || !PRESCRIBERS.includes(user.role)) {
      res.status(403).json({ success: false, error: 'Only doctors can write prescriptions.' });
      return;
    }
    const parsed = createSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Please check the prescription.' });
      return;
    }
    const d = parsed.data;
    if (!(await canReadPatientRecords(user, d.patientId))) {
      res.status(403).json({ success: false, error: 'This patient has not shared their records with you yet, so you cannot prescribe for them here.' });
      return;
    }
    const me = await userStore.findById(String(user.userId));
    const now = new Date().toISOString();
    const rx: IPrescription = {
      id: `RX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      patientId: d.patientId,
      patientName: patientName(d.patientId),
      drugName: d.drugName,
      dosage: d.dosage,
      frequency: d.frequency,
      duration: d.duration,
      instructions: d.instructions || undefined,
      status: 'Active',
      prescribedBy: String(user.userId),
      prescriberName: me?.name || 'Doctor',
      createdAt: now,
      updatedAt: now
    };
    list().push(rx);
    stateStore.saveState();
    await auditService.logEvent({
      patientId: d.patientId,
      actorId: String(user.userId),
      actorRole: user.role as UserRole,
      action: 'PRESCRIPTION_CREATED',
      details: { prescriptionId: rx.id }
    });
    res.status(201).json({ success: true, message: `Prescription for ${rx.drugName} saved.`, data: rx });
  },

  /** PATCH /api/prescriptions/:id  body: { status: 'Stopped' | 'Active' } — only the prescriber */
  async setStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const rx = list().find((p) => p.id === req.params.id);
    if (!rx) {
      res.status(404).json({ success: false, error: 'Prescription not found.' });
      return;
    }
    if (rx.prescribedBy !== String(req.user?.userId)) {
      res.status(403).json({ success: false, error: 'Only the doctor who wrote this prescription can change it.' });
      return;
    }
    const status = (req.body || {}).status;
    if (status !== 'Active' && status !== 'Stopped') {
      res.status(400).json({ success: false, error: 'Status must be Active or Stopped.' });
      return;
    }
    rx.status = status;
    rx.updatedAt = new Date().toISOString();
    stateStore.saveState();
    await auditService.logEvent({
      patientId: rx.patientId,
      actorId: String(req.user?.userId),
      actorRole: req.user?.role as UserRole,
      action: status === 'Stopped' ? 'PRESCRIPTION_STOPPED' : 'PRESCRIPTION_RESUMED',
      details: { prescriptionId: rx.id }
    });
    res.status(200).json({ success: true, data: rx });
  }
};
