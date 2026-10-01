import { apiClient } from './apiClient.js';

export type ConsentStatus = 'pending' | 'granted' | 'declined' | 'revoked';

export interface DoctorCard {
  doctorId: string;
  name: string;
  licenseId?: string;
  specialty?: string;
  hospitalName?: string;
}

export interface ConsentEntry {
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctor: DoctorCard | null;
  status: ConsentStatus;
  reason: string | null;
  requestedAt: string | null;
  decidedAt: string | null;
  updatedAt: string;
  /** Set when an administrator changed this permission for the patient (emergency override). */
  override?: { byName: string; reason: string; at: string; change: 'granted' | 'revoked' } | null;
}

export interface ConsentOverview {
  scope: 'patient' | 'doctor';
  entries: ConsentEntry[];
  counts: { granted: number; pending: number };
}

/** Record permissions: one status endpoint, and the patient's four decisions. */
export const consentApi = {
  /** Patients get every doctor involved; doctors get every patient involved. */
  status: async (): Promise<ConsentOverview> => (await apiClient.get('/api/access/status')).data.data,

  searchDoctors: async (q = ''): Promise<DoctorCard[]> => (await apiClient.get('/api/access/doctors', { params: { q } })).data.data,

  /** Doctor → patient. */
  request: async (patientId: string, reason?: string): Promise<ConsentEntry> =>
    (await apiClient.post('/api/access/request', { patientId, reason })).data.data,

  /** Patient decisions (always about the signed-in patient's own records). */
  grant: async (doctorId: string): Promise<{ message: string }> => (await apiClient.post('/api/access/grant', { doctorId })).data,
  decline: async (doctorId: string): Promise<{ message: string }> => (await apiClient.post('/api/access/decline', { doctorId })).data,
  revoke: async (doctorId: string): Promise<{ message: string }> => (await apiClient.post('/api/access/revoke', { doctorId })).data
};

export const summaryApi = {
  get: async (): Promise<Record<string, number>> => (await apiClient.get('/api/summary')).data.data
};
