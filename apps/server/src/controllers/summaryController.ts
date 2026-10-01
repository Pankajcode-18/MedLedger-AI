import { Response } from 'express';
import { stateStore } from '../models/stateStore.js';
import { consentService } from '../services/consentService.js';
import { orgCollections } from '../services/orgCollections.js';
import { visibleReports } from './recordController.js';
import { AuthenticatedRequest } from '../types/index.js';

/**
 * GET /api/summary — the numbers every dashboard shows, counted once on the server
 * with the same rules the lists use, so a count and its list always agree.
 */
export const summaryController = {
  async get(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Please sign in.' });
      return;
    }
    const uid = String(user.userId);
    const state = stateStore.getState();
    const records = visibleReports(user, state.reports);
    const out: Record<string, number> = { records: records.length };

    if (user.role === 'patient') {
      const consents = consentService.forPatient(uid);
      out.doctorsWithAccess = consents.filter((c) => c.status === 'granted').length;
      out.pendingRequests = consents.filter((c) => c.status === 'pending').length;
      out.readings = (state.vitals || []).filter((v) => v.patientId === uid).length;
      out.activePrescriptions = (state.prescriptions || []).filter((p) => p.patientId === uid && p.status === 'Active').length;
      out.claims = orgCollections.forPatient('claims', uid).length;
    } else if (['doctor', 'hospital', 'hospital-admin'].includes(user.role)) {
      const consents = consentService.forDoctor(uid);
      out.patientsSharing = consents.filter((c) => c.status === 'granted').length;
      out.waitingForPatients = consents.filter((c) => c.status === 'pending').length;
      out.activePrescriptions = (state.prescriptions || []).filter((p) => p.prescribedBy === uid && p.status === 'Active').length;
      if (user.role !== 'doctor') {
        const adm = orgCollections.list('admissions', uid);
        out.inHospital = adm.filter((a) => a.status !== 'Discharged').length;
        out.inIcu = adm.filter((a) => a.status === 'ICU').length;
        const staff = orgCollections.list('staff', uid);
        out.staff = staff.length;
        out.staffOnDuty = staff.filter((s) => s.status === 'On duty').length;
      }
    } else if (user.role === 'lab') {
      const samples = orgCollections.list('samples', uid);
      out.samplesWaiting = samples.filter((s) => s.status === 'Received' || s.status === 'Processing').length;
      out.urgent = samples.filter((s) => s.priority === 'Urgent' && s.status !== 'Uploaded').length;
      out.readyToUpload = samples.filter((s) => s.status === 'Report ready').length;
    } else if (user.role === 'insurance') {
      const claims = orgCollections.list('claims', uid);
      out.waitingForDecision = claims.filter((c) => c.status === 'Submitted' || c.status === 'Needs information').length;
      out.approvedNotPaid = claims.filter((c) => c.status === 'Approved').length;
      out.activePolicies = orgCollections.list('policyholders', uid).filter((p) => p.status !== 'Lapsed').length;
    } else {
      out.accounts = (state.users || []).length;
      out.organisations = orgCollections.list('organisations').length;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: out });
  }
};
