import { consentService } from './consentService.js';
import { AuthenticatedUser } from '../types/index.js';

const ADMIN = ['admin', 'system-admin'];
const CONSENT_ROLES = ['doctor', 'hospital', 'hospital-admin'];

/**
 * Can this user read a patient's health records?
 *  - patients: only their own
 *  - administrators: yes (audited)
 *  - doctors / hospitals: only while the patient's permission is granted (the consent list is the one source)
 *  - labs / insurers: no (they work with the records they upload or are sent with a claim)
 */
export const canReadPatientRecords = async (user: AuthenticatedUser | undefined, patientId: string): Promise<boolean> => {
  if (!user) return false;
  const uid = String(user.userId);
  if (user.role === 'patient') return uid === String(patientId);
  if (ADMIN.includes(user.role)) return true;
  if (!CONSENT_ROLES.includes(user.role)) return false;
  if (consentService.isGranted(String(patientId), uid)) return true;
  return Boolean(user.walletAddress && consentService.isGranted(String(patientId), user.walletAddress));
};
