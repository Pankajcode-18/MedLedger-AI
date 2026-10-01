import { stateStore } from '../models/stateStore.js';

/** Who is registered, as other users may see them: names and work details only, never IDs numbers or addresses. */

const titleCase = (s?: string) => (s || '').trim().replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const practice = (userId: string): Record<string, unknown> =>
  stateStore.getState().settings?.find((s) => s.userId === userId && s.section === 'practice')?.values || {};

export interface DoctorEntry {
  doctorId: string;
  name: string;
  email?: string;
  licenseId?: string;
  specialty?: string;
  hospitalName?: string;
}

export interface PatientEntry {
  patientId: string;
  name: string;
  email?: string;
  age?: string;
}

export const directory = {
  doctors(): DoctorEntry[] {
    const state = stateStore.getState();
    const out = new Map<string, DoctorEntry>();
    for (const d of state.doctors) {
      out.set(String(d.doctorId), { doctorId: String(d.doctorId), name: d.name, email: d.email, licenseId: d.licenseId });
    }
    for (const u of state.users || []) {
      if (u.role !== 'doctor' || u.disabled) continue;
      const prev = out.get(u.userId);
      out.set(u.userId, { ...prev, doctorId: u.userId, name: u.name || prev?.name || 'Doctor', email: u.email });
    }
    return [...out.values()].map((d) => {
      const p = practice(d.doctorId);
      return {
        ...d,
        name: String(p.name || d.name || 'Doctor'),
        licenseId: String(p.license || d.licenseId || '') || undefined,
        specialty: String(p.department || '') || undefined,
        hospitalName: String(p.hospital || '') || undefined
      };
    });
  },

  doctorName(id: string): string {
    return this.doctors().find((d) => d.doctorId === String(id))?.name || 'A doctor';
  },

  patients(): PatientEntry[] {
    const state = stateStore.getState();
    const out = new Map<string, PatientEntry>();
    for (const p of state.patients) out.set(String(p.patientId), { patientId: String(p.patientId), name: titleCase(p.name), email: p.email, age: p.age });
    for (const u of state.users || []) {
      if (u.role !== 'patient' || u.disabled) continue;
      const prev = out.get(u.userId);
      out.set(u.userId, { ...prev, patientId: u.userId, name: titleCase(u.name) || prev?.name || 'Patient', email: u.email });
    }
    return [...out.values()];
  },

  patientName(id: string): string {
    return this.patients().find((p) => p.patientId === String(id))?.name || 'A patient';
  },

  /** Display name of any account (used for administrators). */
  userName(id: string): string | undefined {
    return (stateStore.getState().users || []).find((u) => u.userId === String(id))?.name || undefined;
  }
};
