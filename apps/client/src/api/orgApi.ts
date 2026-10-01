import { apiClient } from './apiClient.js';

/** Items kept by organisations (staff, admissions, samples, claims, policyholders, organisations). */
interface Base {
  id: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffMember extends Base {
  name: string;
  role: string;
  department: string;
  licenceNo?: string;
  phone?: string;
  status: 'On duty' | 'Off duty' | 'On leave';
}

export interface Admission extends Base {
  patientName: string;
  patientId?: string;
  ward: string;
  bed: string;
  doctorName: string;
  reason?: string;
  status: 'Admitted' | 'ICU' | 'Discharged';
  admittedAt: string;
  dischargedAt?: string;
}

export interface LabSample extends Base {
  patientName: string;
  patientId?: string;
  test: string;
  category?: string;
  priority: 'Routine' | 'Urgent';
  status: 'Received' | 'Processing' | 'Report ready' | 'Uploaded';
  collectedAt: string;
  reportId?: string;
}

export type Currency = 'NPR' | 'INR';

export interface Claim extends Base {
  patientName: string;
  patientId?: string;
  policyNo: string;
  provider: string;
  service: string;
  amount: number;
  approvedAmount?: number;
  currency: Currency;
  status: 'Submitted' | 'Needs information' | 'Approved' | 'Rejected' | 'Paid';
  reportId?: string;
  note?: string;
  paidAt?: string;
}

export interface Policyholder extends Base {
  name: string;
  patientId?: string;
  policyNo: string;
  plan: string;
  sumInsured: number;
  currency: Currency;
  validTill?: string;
  phone?: string;
  status: 'Active' | 'Lapsed';
}

export interface Organisation extends Base {
  name: string;
  type: 'Hospital' | 'Clinic' | 'Laboratory' | 'Insurance' | 'Pharmacy';
  registrationNo?: string;
  district?: string;
  country: 'Nepal' | 'India';
  phone?: string;
  verified: boolean;
}

const make = <T extends Base>(path: string) => ({
  list: async (): Promise<T[]> => (await apiClient.get(path)).data.data || [],
  create: async (payload: Record<string, unknown>): Promise<T> => (await apiClient.post(path, payload)).data.data,
  update: async (id: string, changes: Record<string, unknown>): Promise<T> =>
    (await apiClient.patch(`${path}/${encodeURIComponent(id)}`, changes)).data.data
});

export const staffApi = make<StaffMember>('/api/staff');
export const admissionsApi = make<Admission>('/api/admissions');
export const samplesApi = make<LabSample>('/api/samples');
export const claimsApi = make<Claim>('/api/claims');
export const policyholdersApi = make<Policyholder>('/api/policyholders');
export const organisationsApi = make<Organisation>('/api/organisations');
