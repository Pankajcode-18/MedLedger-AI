import { blockchainService } from '../services/blockchainService.js';
import { Request, Response } from 'express';
import { stateStore } from '../models/stateStore.js';
import { auditService } from '../services/auditService.js';
import { userStore } from '../services/userStore.js';
import { directory } from '../services/directory.js';
import { canReadPatientRecords } from '../services/accessPolicy.js';
import { IAuditLogEntry } from '../types/index.js';

/**
 * Adds the names people need to read an activity line ("Dr. Anil Sharma opened Blood test")
 * without exposing anything the viewer could not already see.
 */
const enrich = (logs: IAuditLogEntry[]) => {
  const state = stateStore.getState();
  const users = new Map((state.users || []).map((u) => [u.userId, u.name]));
  const doctors = new Map(directory.doctors().map((d) => [d.doctorId, d.name]));
  const patients = new Map(directory.patients().map((p) => [p.patientId, p.name]));
  const reports = new Map(state.reports.map((r) => [r.reportId, r.description || r.fileName]));
  const nameOf = (id?: string) => (id ? doctors.get(id) || patients.get(id) || users.get(id) : undefined);
  return logs.map((l) => {
    const d = (l.details || {}) as Record<string, unknown>;
    const reportId = typeof d.reportId === 'string' ? d.reportId : undefined;
    const doctorId = typeof d.doctorId === 'string' ? d.doctorId : undefined;
    return {
      ...l,
      actorName: nameOf(String(l.actorId)) || null,
      patientName: l.patientId && l.patientId !== 'system' ? patients.get(String(l.patientId)) || null : null,
      doctorName: doctorId ? doctors.get(doctorId) || null : null,
      recordTitle: reportId ? reports.get(reportId) || null : null
    };
  });
};
import { AuthenticatedRequest } from '../types/index.js';

export class AdminController {
  public async getStats(_req: Request, res: Response): Promise<void> {
    const state = stateStore.getState();
    res.status(200).json({
      success: true,
      data: {
        totalPatients: state.patients?.length || 0,
        totalDoctors: state.doctors?.length || 0,
        totalReports: state.reports?.length || 0,
        totalBlocks: blockchainService.getBlocks().length,
        networkStatus: (() => {
          const n = blockchainService.networkInfo();
          return n.mode === 'contract' ? `On ${n.network} (contract ${String(n.contractAddress).slice(0, 10)}…)` : 'This server only (no contract set up)';
        })(),
        ledger: { ...blockchainService.networkInfo(), intact: blockchainService.verifyChain().intact },
        tamperAlerts: (state.auditLogs || []).filter((l) => l.action === 'RECORD_TAMPER_DETECTED').length
      }
    });
  }

  /**
   * GET /api/admin/security?days=30
   * Real sign-in and integrity figures from the activity log and the account list.
   */
  public async getSecurity(req: Request, res: Response): Promise<void> {
    try {
      const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
      const since = Date.now() - days * 86_400_000;
      const logs = (await auditService.getAllLogs()).filter((l) => new Date(l.timestamp).getTime() >= since);
      const count = (action: string) => logs.filter((l) => l.action === action).length;
      const users = await userStore.listAll();
      const SECURITY = ['LOGIN_FAILED', 'ACCOUNT_LOCKED', 'RECORD_TAMPER_DETECTED', 'ACCOUNT_DISABLED', 'ACCOUNT_ENABLED', 'PASSWORD_CHANGED', 'PASSWORD_RESET_COMPLETED'];
      const recent = logs
        .filter((l) => SECURITY.includes(l.action))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 25)
        .map((l) => ({
          action: l.action,
          at: l.timestamp,
          actorId: l.actorId,
          actorRole: l.actorRole,
          email: typeof l.details?.email === 'string' ? l.details.email : undefined,
          reportId: typeof l.details?.reportId === 'string' ? l.details.reportId : undefined
        }));
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        success: true,
        data: {
          days,
          successfulSignIns: count('USER_LOGGED_IN'),
          failedSignIns: count('LOGIN_FAILED') + count('ACCOUNT_LOCKED'),
          lockouts: count('ACCOUNT_LOCKED'),
          tamperAlerts: count('RECORD_TAMPER_DETECTED'),
          totalAccounts: users.length,
          disabledAccounts: users.filter((u) => u.status === 'Disabled').length,
          walletLinkedAccounts: users.filter((u) => u.walletLinked).length,
          recent
        }
      });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }

  public async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const actionFilter = req.query.action as string;
      let logs = await auditService.getAllLogs();

      if (actionFilter) {
        logs = logs.filter((l) => l.action.toLowerCase() === actionFilter.toLowerCase());
      }

      res.status(200).json({
        success: true,
        count: logs.length,
        data: enrich(logs),
        auditLog: logs
      });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }

  /** Activity feed for the signed-in user (their own record events + actions they performed). */
  public async getMyAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Please sign in.' });
        return;
      }
      const logs = await auditService.getLogsForUser(String(userId));
      res.status(200).json({ success: true, count: logs.length, data: enrich(logs) });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }

  public async getPatientAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const patientId = req.params.patientId || req.user?.userId;
      if (!patientId) {
        res.status(400).json({ success: false, error: 'Patient ID is required.' });
        return;
      }

      if (!(await canReadPatientRecords(req.user, String(patientId)))) {
        res.status(403).json({ success: false, error: "You do not have the patient's permission to see their activity." });
        return;
      }
      const logs = enrich(await auditService.getLogsForPatient(patientId));
      res.status(200).json({
        success: true,
        patientId,
        count: logs.length,
        data: logs,
        auditLog: logs
      });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }
}

export const adminController = new AdminController();
