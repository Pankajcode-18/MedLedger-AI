import { apiClient } from './apiClient.js';
import { AuditLog } from '../types/index.js';

export const adminApi = {
  getStats: async (): Promise<{
    totalPatients: number;
    totalDoctors: number;
    totalReports: number;
    totalBlocks: number;
    networkStatus: string;
    ledger?: { mode: 'contract' | 'simulated'; network: string; chainId: number; contractAddress: string | null; intact: boolean };
    tamperAlerts: number;
  }> => {
    const res = await apiClient.get('/api/admin/stats');
    return res.data.data;
  },

  /** Real sign-in and integrity figures from the activity log (admins only). */
  getSecurity: async (days = 30): Promise<SecuritySummary> => {
    const res = await apiClient.get('/api/admin/security', { params: { days } });
    return res.data.data;
  },

  getAllAuditLogs: async (action?: string): Promise<AuditLog[]> => {
    const res = await apiClient.get('/api/admin/audit', {
      params: { action }
    });
    return res.data.data || res.data.auditLog || [];
  },

  getPatientAuditLogs: async (patientId: string): Promise<AuditLog[]> => {
    const res = await apiClient.get(`/api/admin/audit/${patientId}`);
    return res.data.data || res.data.auditLog || [];
  },

  /** Signed-in user's own activity: events on their records plus actions they performed. */
  getMyActivity: async (): Promise<AuditLog[]> => {
    const res = await apiClient.get('/api/admin/audit/me');
    return res.data.data || [];
  },

  listUsers: async (): Promise<AdminUser[]> => {
    const res = await apiClient.get('/api/admin/users');
    return res.data.data || [];
  },

  createUser: async (payload: { name: string; email: string; password: string; role: string }): Promise<AdminUser> => {
    const res = await apiClient.post('/api/admin/users', payload);
    return res.data.data.user;
  },

  setUserStatus: async (userId: string, disabled: boolean): Promise<void> => {
    await apiClient.patch(`/api/admin/users/${encodeURIComponent(userId)}/status`, { disabled });
  }
};

export interface AdminUser {
  userId: string;
  email: string;
  role: string;
  name: string;
  walletAddress?: string;
  status?: 'Active' | 'Disabled';
  createdAt?: string;
  isDemo?: boolean;
}

export interface SecuritySummary {
  days: number;
  successfulSignIns: number;
  failedSignIns: number;
  lockouts: number;
  tamperAlerts: number;
  totalAccounts: number;
  disabledAccounts: number;
  walletLinkedAccounts: number;
  recent: Array<{ action: string; at: string; actorId: string; actorRole: string; email?: string; reportId?: string }>;
}
