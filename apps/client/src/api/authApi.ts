import { apiClient } from './apiClient.js';
import { User, Patient, Doctor } from '../types/index.js';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: string;
  phone?: string;
  walletAddress?: string;
}

export interface SessionInfo {
  id: string;
  device: string;
  ip: string;
  signedInAt: string;
  expiresAt: string;
  current: boolean;
}

export const authApi = {
  /** "Try a demo": sign in to the sample account for a role (only when the server runs in demo mode). */
  demoLogin: async (role: string): Promise<{ token: string; user: User }> => {
    const res = await apiClient.post('/api/auth/demo', { role });
    return res.data.data;
  },

  login: async (payload: LoginPayload): Promise<{ token: string; user: User }> => {
    const res = await apiClient.post('/api/auth/login', payload);
    return res.data.data;
  },

  register: async (payload: RegisterPayload): Promise<{ token: string; user: User }> => {
    const res = await apiClient.post('/api/auth/register', payload);
    return res.data.data;
  },

  /** Revokes the given token on the server. Token is passed explicitly because local storage may already be cleared. */
  logout: async (token: string): Promise<void> => {
    await apiClient.post('/api/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } });
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ token: string; user: User; message: string }> => {
    const res = await apiClient.post('/api/auth/change-password', { currentPassword, newPassword });
    return { ...res.data.data, message: res.data.message };
  },

  forgotPassword: async (email: string): Promise<{ message: string; devResetLink?: string; devResetToken?: string }> => {
    const res = await apiClient.post('/api/auth/forgot-password', { email });
    return res.data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const res = await apiClient.post('/api/auth/reset-password', { token, newPassword });
    return res.data;
  },

  listSessions: async (): Promise<SessionInfo[]> => {
    const res = await apiClient.get('/api/auth/sessions');
    return res.data.data || [];
  },

  logoutOthers: async (): Promise<{ message: string; ended: number }> => {
    const res = await apiClient.post('/api/auth/logout-others');
    return res.data;
  },

  getProfile: async (): Promise<User> => {
    const res = await apiClient.get('/api/auth/profile');
    return res.data.data;
  },

  getPatients: async (): Promise<Patient[]> => {
    const res = await apiClient.get('/patientdatas');
    return res.data;
  },

  getDoctors: async (): Promise<Doctor[]> => {
    const res = await apiClient.get('/doctordatas');
    return res.data;
  },

  registerPatient: async (data: Partial<Patient>): Promise<Patient> => {
    const res = await apiClient.post('/registerPatient', data);
    return res.data.data;
  },

  registerDoctor: async (data: Partial<Doctor>): Promise<Doctor> => {
    const res = await apiClient.post('/registerDoctor', data);
    return res.data.data;
  }
};

