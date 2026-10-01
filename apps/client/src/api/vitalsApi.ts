import { apiClient } from './apiClient.js';
import { VitalReading, VitalType } from '../types/index.js';

export interface NewVitalReading {
  type: VitalType;
  value: number;
  value2?: number;
  /** "C"/"F" for temperature, "kg"/"lb" for weight */
  unit?: string;
  takenAt?: string;
  note?: string;
  patientId?: string;
}

/** Home and clinic measurements (blood pressure, sugar, weight…) that feed the trend charts. */
export const vitalsApi = {
  list: async (patientId?: string): Promise<VitalReading[]> => {
    const res = await apiClient.get('/api/vitals', { params: patientId ? { patientId } : {} });
    return res.data.data.readings;
  },

  add: async (reading: NewVitalReading): Promise<VitalReading> => {
    const res = await apiClient.post('/api/vitals', reading);
    return res.data.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/vitals/${encodeURIComponent(id)}`);
  }
};
