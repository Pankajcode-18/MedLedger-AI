import { Response } from 'express';
import { z } from 'zod';
import { consentService, ConsentError, ConsentEvidence } from '../services/consentService.js';
import { directory } from '../services/directory.js';
import { AuthenticatedRequest, IConsent } from '../types/index.js';

const ADMINS = ['admin', 'system-admin'];
const ASKERS = ['doctor', 'hospital', 'hospital-admin'];

const idText = z.string().trim().min(1).max(64);

const fail = (res: Response, err: unknown) => {
  if (err instanceof ConsentError) {
    res.status(err.status).json({ success: false, error: err.message });
    return;
  }
  console.error('[Access]', err);
  res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
};

/** Consent entry as shown to people: names instead of bare IDs. */
const present = (c: IConsent) => ({
  patientId: c.patientId,
  patientName: directory.patientName(c.patientId),
  doctorId: c.doctorId,
  doctorName: directory.doctorName(c.doctorId),
  doctor: directory.doctors().find((d) => d.doctorId === c.doctorId) || null,
  status: c.status,
  reason: c.reason || null,
  requestedAt: c.requestedAt || null,
  decidedAt: c.decidedAt || null,
  updatedAt: c.updatedAt,
  override: c.override ? { byName: directory.userName(c.override.by) || 'An administrator', reason: c.override.reason, at: c.override.at, change: c.override.change } : null
});

/**
 * Consent evidence for this request. Patients decide in their session (or with a wallet, elsewhere);
 * an administrator's change is a break-glass override: a written reason is required, the patient is
 * told, and the record-history entry is marked as an override. Returns null (and answers) when refused.
 */
const evidenceFor = (req: AuthenticatedRequest, res: Response): ConsentEvidence | null => {
  if (!ADMINS.includes(req.user?.role || '')) return { method: 'session' };
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 10) {
    res.status(400).json({
      success: false,
      error: 'Administrators may change a patient’s sharing only in an emergency. Please give the reason (at least 10 characters); the patient will see it.'
    });
    return null;
  }
  return { method: 'admin-override', reason: reason.slice(0, 500), overrideBy: String(req.user?.userId) };
};

const actorOf = (req: AuthenticatedRequest) => ({ userId: String(req.user?.userId), role: String(req.user?.role) });

/**
 * The patient a consent change is about. A patient may only change their own; an administrator must say whose.
 * Returns null (and answers the request) when not allowed.
 */
const ownPatient = (req: AuthenticatedRequest, res: Response): string | null => {
  const role = req.user?.role || '';
  const asked = typeof req.body?.patientId === 'string' ? req.body.patientId.trim() : '';
  if (role === 'patient') {
    if (asked && asked !== String(req.user?.userId)) {
      res.status(403).json({ success: false, error: 'You can only change who sees your own records.' });
      return null;
    }
    return String(req.user?.userId);
  }
  if (ADMINS.includes(role) && asked) return asked;
  res.status(403).json({ success: false, error: 'Only the patient can decide who sees their records.' });
  return null;
};

const doctorFrom = (req: AuthenticatedRequest, res: Response): string | null => {
  const parsed = idText.safeParse(req.body?.doctorId);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Choose a doctor.' });
    return null;
  }
  if (!directory.doctors().some((d) => d.doctorId === parsed.data)) {
    res.status(404).json({ success: false, error: 'No doctor with this ID is registered.' });
    return null;
  }
  return parsed.data;
};

export class AccessController {
  /** POST /api/access/request { patientId, reason? } — a doctor asks a patient to share their records. */
  public async requestAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
    const role = req.user?.role || '';
    if (!ASKERS.includes(role)) {
      res.status(403).json({ success: false, error: 'Only doctors can ask to see a patient’s records.' });
      return;
    }
    const patientId = idText.safeParse(req.body?.patientId);
    if (!patientId.success || !directory.patients().some((p) => p.patientId === patientId.data)) {
      res.status(404).json({ success: false, error: 'Choose a registered patient.' });
      return;
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 200) : undefined;
    try {
      const c = await consentService.request(patientId.data, String(req.user?.userId), actorOf(req), reason);
      res.status(200).json({ success: true, message: 'Request sent. The patient decides whether to share.', data: present(c) });
    } catch (err) {
      fail(res, err);
    }
  }

  /** POST /api/access/grant { doctorId } — the patient shares their records with a doctor. */
  public async grantAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
    const patientId = ownPatient(req, res);
    if (!patientId) return;
    const doctorId = doctorFrom(req, res);
    if (!doctorId) return;
    try {
      const evidence = evidenceFor(req, res);
      if (!evidence) return;
      const { ledgerTx, consent } = await consentService.grant(patientId, doctorId, actorOf(req), evidence);
      res.status(200).json({
        success: true,
        message: `${directory.doctorName(doctorId)} can now see your records.`,
        data: { ...present(consent), blockchainTxHash: ledgerTx }
      });
    } catch (err) {
      fail(res, err);
    }
  }

  /** POST /api/access/decline { doctorId } — the patient says no to an open request. */
  public async rejectAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
    const patientId = ownPatient(req, res);
    if (!patientId) return;
    const doctorId = doctorFrom(req, res);
    if (!doctorId) return;
    try {
      const consent = await consentService.decline(patientId, doctorId, actorOf(req));
      res.status(200).json({ success: true, message: 'Request declined.', data: present(consent) });
    } catch (err) {
      fail(res, err);
    }
  }

  /** POST /api/access/revoke { doctorId } — the patient stops sharing. */
  public async revokeAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
    const patientId = ownPatient(req, res);
    if (!patientId) return;
    const doctorId = doctorFrom(req, res);
    if (!doctorId) return;
    try {
      const evidence = evidenceFor(req, res);
      if (!evidence) return;
      const { ledgerTx, consent } = await consentService.revoke(patientId, doctorId, actorOf(req), evidence);
      res.status(200).json({
        success: true,
        message: `${directory.doctorName(doctorId)} can no longer see your records.`,
        data: { ...present(consent), blockchainTxHash: ledgerTx }
      });
    } catch (err) {
      fail(res, err);
    }
  }

  /**
   * GET /api/access/status
   * The one answer to "who can see what": a patient gets every doctor they have shared with or been asked by;
   * a doctor gets every patient they have asked or who shares with them. Admins pass ?patientId= or ?doctorId=.
   */
  public async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const role = req.user?.role || '';
    const uid = String(req.user?.userId);
    let entries: IConsent[] = [];
    let scope: 'patient' | 'doctor';
    if (role === 'patient') {
      scope = 'patient';
      entries = consentService.forPatient(uid);
    } else if (ASKERS.includes(role)) {
      scope = 'doctor';
      entries = consentService.forDoctor(uid);
    } else if (ADMINS.includes(role) && (req.query.patientId || req.query.doctorId)) {
      scope = req.query.patientId ? 'patient' : 'doctor';
      entries = req.query.patientId ? consentService.forPatient(String(req.query.patientId)) : consentService.forDoctor(String(req.query.doctorId));
    } else {
      res.status(403).json({ success: false, error: 'Only patients and doctors have record permissions.' });
      return;
    }
    const shown = entries
      .filter((c) => c.status !== 'revoked' || scope === 'patient')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(present);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data: {
        scope,
        entries: shown,
        counts: {
          granted: shown.filter((c) => c.status === 'granted').length,
          pending: shown.filter((c) => c.status === 'pending').length
        }
      }
    });
  }

  /** GET /api/access/doctors?q= — doctors a patient can choose from. */
  public async searchDoctors(req: AuthenticatedRequest, res: Response): Promise<void> {
    const q = String(req.query.q || '').trim().toLowerCase();
    const doctors = directory
      .doctors()
      .filter((d) => !q || [d.name, d.specialty, d.hospitalName, d.licenseId].some((v) => (v || '').toLowerCase().includes(q)))
      .slice(0, 25)
      .map(({ email: _e, ...d }) => d);
    res.status(200).json({ success: true, data: doctors });
  }
}

export const accessController = new AccessController();
