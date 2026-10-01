import { apiClient } from './apiClient.js';

export interface Prescription {
  id: string;
  patientId: string;
  patientName?: string;
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  status: 'Active' | 'Stopped';
  prescribedBy: string;
  prescriberName: string;
  createdAt: string;
  updatedAt: string;
}

export const prescriptionsApi = {
  list: async (patientId?: string): Promise<Prescription[]> => {
    const res = await apiClient.get('/api/prescriptions', { params: patientId ? { patientId } : undefined });
    return res.data.data || [];
  },
  create: async (payload: {
    patientId: string;
    drugName: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }): Promise<Prescription> => {
    const res = await apiClient.post('/api/prescriptions', payload);
    return res.data.data;
  },
  setStatus: async (id: string, status: 'Active' | 'Stopped'): Promise<Prescription> => {
    const res = await apiClient.patch(`/api/prescriptions/${encodeURIComponent(id)}`, { status });
    return res.data.data;
  }
};
