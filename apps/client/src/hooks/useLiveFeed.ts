import { useCallback, useEffect } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { useUIStore } from '../store/uiStore.js';
import { recordsApi } from '../api/recordsApi.js';
import { consentApi } from '../api/consentApi.js';
import { adminApi } from '../api/adminApi.js';
import { authApi } from '../api/authApi.js';
import { auditLogToActivity, buildNotifications, mergeRepeats, NameLookup } from '../lib/activityFeed.js';
import { settingsApi } from '../api/settingsApi.js';
import { AuditLog, MedicalRecord } from '../types/index.js';

const REFRESH_MS = 30_000;

/** Directory of patient/doctor names so the feed can show a name instead of an ID. */
const loadNames = async (): Promise<NameLookup> => {
  const names: NameLookup = {};
  const [patients, doctors] = await Promise.allSettled([authApi.getPatients(), authApi.getDoctors()]);
  if (patients.status === 'fulfilled' && Array.isArray(patients.value)) {
    patients.value.forEach((p) => (names[String(p.patientId)] = p.name));
  }
  if (doctors.status === 'fulfilled' && Array.isArray(doctors.value)) {
    doctors.value.forEach((d) => (names[String(d.doctorId)] = d.name.startsWith('Dr') ? d.name : `Dr. ${d.name}`));
  }
  return names;
};

/**
 * Keeps notifications and the activity trail in sync with the backend
 * for whoever is signed in. Mounted once by the dashboard shell.
 */
export const useLiveFeed = (): { refresh: () => Promise<void> } => {
  const user = useAuthStore((s) => s.user);
  const setNotifications = useUIStore((s) => s.setNotifications);
  const setActivity = useUIStore((s) => s.setActivity);
  const setSeenAt = useUIStore((s) => s.setSeenAt);

  const refresh = useCallback(async () => {
    if (!user) return;
    const role = user.role;
    const isAdmin = role === 'admin' || role === 'system-admin';

    const consentRoles = ['patient', 'doctor', 'hospital', 'hospital-admin'];
    const [recordsRes, statusRes, logsRes, namesRes, inboxRes] = await Promise.allSettled([
      recordsApi.getRecords({ summary: true, limit: 20 }),
      consentRoles.includes(role) ? consentApi.status() : Promise.resolve(null),
      isAdmin ? adminApi.getAllAuditLogs() : adminApi.getMyActivity(),
      loadNames(),
      settingsApi.get('inbox')
    ]);
    if (inboxRes.status === 'fulfilled') {
      const seen = inboxRes.value.values.seenAt;
      // first visit: only the last day counts as new
      setSeenAt(typeof seen === 'string' ? seen : new Date(Date.now() - 86_400_000).toISOString());
    }
    const names: NameLookup = namesRes.status === 'fulfilled' ? namesRes.value : {};

    const records: MedicalRecord[] =
      recordsRes.status === 'fulfilled' && Array.isArray(recordsRes.value) ? recordsRes.value : [];
    const consents = statusRes.status === 'fulfilled' && statusRes.value ? statusRes.value.entries : [];
    setNotifications(buildNotifications({ role, userId: String(user.userId), records, consents }));

    if (logsRes.status === 'fulfilled') {
      const logs: AuditLog[] = Array.isArray(logsRes.value) ? logsRes.value : [];
      const sorted = [...logs].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setActivity(mergeRepeats(sorted.slice(0, 200).map((log, i) => auditLogToActivity(log, i, names, isAdmin ? undefined : String(user.userId)))).slice(0, 100));
    } else {
      setActivity([]);
    }
  }, [user, setNotifications, setActivity, setSeenAt]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { refresh };
};
