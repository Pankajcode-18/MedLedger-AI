import { formatDate } from './format.js';
import { ActivityItem, AuditLog, NotificationItem, MedicalRecord } from '../types/index.js';

/** "just now", "5 minutes ago", "Yesterday", "Sep 18, 2026" */
export const relativeTime = (value?: string | Date | number): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 45) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return formatDate(date);
};

export const formatDateTime = (value?: string | Date | number): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = formatDate(date);
  return `${day}, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

/** Greeting that matches the viewer's local time of day. */
export const timeOfDayGreeting = (now: Date = new Date()): string => {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const dateGroupFor = (date: Date): ActivityItem['dateGroup'] => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const diffDays = (startOfToday.getTime() - new Date(date).setHours(0, 0, 0, 0)) / 86400000;
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'Last 7 days';
  return 'Earlier';
};

const ROLE_LABEL: Record<string, string> = {
  patient: 'Patient',
  doctor: 'Physician',
  hospital: 'Hospital',
  'hospital-admin': 'Hospital',
  lab: 'Laboratory',
  insurance: 'Insurance',
  admin: 'Administrator',
  'system-admin': 'Administrator',
  system: 'System'
};

interface ActionMeta {
  title: string;
  tag: string;
  category: ActivityItem['category'];
  status: ActivityItem['status'];
  explanation: string;
}

const ACTION_META: Record<string, ActionMeta> = {
  USER_REGISTERED: {
    title: 'Account Created',
    tag: 'ACCOUNT',
    category: 'login',
    status: 'Completed',
    explanation: 'A new MedLedger identity was created and linked to an Ethereum wallet address.'
  },
  USER_LOGGED_IN: {
    title: 'Signed In',
    tag: 'LOGIN',
    category: 'login',
    status: 'Completed',
    explanation: 'A successful sign-in was recorded for security auditing.'
  },
  RECORD_UPLOADED_AND_ENCRYPTED: {
    title: 'Medical Record Uploaded & Encrypted',
    tag: 'RECORD',
    category: 'record',
    status: 'Verified',
    explanation:
      'The document was encrypted with AES-256-GCM and its SHA-256 fingerprint was anchored on the ledger.'
  },
  RECORD_DOWNLOADED: {
    title: 'Medical Record Opened',
    tag: 'RECORD ACCESS',
    category: 'record',
    status: 'Completed',
    explanation: 'An authorised user downloaded this record. The access was written to the audit trail.'
  },
  ACCESS_REQUESTED: {
    title: 'Access Requested',
    tag: 'CONSENT REQUEST',
    category: 'access',
    status: 'Pending',
    explanation: 'A clinician asked for permission to view records. Access stays locked until the patient approves.'
  },
  ACCESS_GRANTED: {
    title: 'Access Granted',
    tag: 'CONSENT',
    category: 'access',
    status: 'Active',
    explanation: 'The patient approved access. The grant was recorded on the ledger.'
  },
  GRANT_ACCESS: {
    title: 'Access Granted',
    tag: 'CONSENT',
    category: 'access',
    status: 'Active',
    explanation: 'The patient approved access. The grant was recorded on the ledger.'
  },
  ACCESS_REJECTED: {
    title: 'Access Request Declined',
    tag: 'CONSENT',
    category: 'access',
    status: 'Revoked',
    explanation: 'The patient declined the access request.'
  },
  ACCESS_REVOKED: {
    title: 'Access Revoked',
    tag: 'CONSENT',
    category: 'access',
    status: 'Revoked',
    explanation: 'The patient withdrew a previously granted permission.'
  },
  REVOKE_ACCESS: {
    title: 'Access Revoked',
    tag: 'CONSENT',
    category: 'access',
    status: 'Revoked',
    explanation: 'The patient withdrew a previously granted permission.'
  },
  ACCESS_OVERRIDE_GRANTED: {
    title: 'Shared by an administrator',
    tag: 'EMERGENCY',
    category: 'access',
    status: 'Active',
    explanation: 'An administrator shared the records in an emergency and gave a reason. The patient was told.'
  },
  ACCESS_OVERRIDE_REVOKED: {
    title: 'Sharing stopped by an administrator',
    tag: 'EMERGENCY',
    category: 'access',
    status: 'Revoked',
    explanation: 'An administrator stopped a doctor seeing the records and gave a reason. The patient was told.'
  },
  RECORD_TEXT_CORRECTED: {
    title: 'Report text corrected',
    tag: 'RECORD',
    category: 'record',
    status: 'Completed',
    explanation: 'Someone checked the text read from a scanned report and corrected it. The original file is unchanged.'
  }
};

const humanise = (action: string): string =>
  action
    .toLowerCase()
    .split('_')
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');

export type NameLookup = Record<string, string>;

/** One plain sentence per event: who did what to which record. */
const sentence = (
  log: AuditLog,
  names: NameLookup,
  viewerId?: string
): { text: string; category: ActivityItem['category']; status: ActivityItem['status'] } => {
  const d = (log.details || {}) as Record<string, unknown>;
  const youAct = viewerId && String(log.actorId) === String(viewerId);
  const youPatient = viewerId && String(log.patientId) === String(viewerId);
  const actor = youAct ? 'You' : log.actorName || names[String(log.actorId)] || ROLE_LABEL[log.actorRole] || 'Someone';
  const patient = youPatient ? 'you' : log.patientName || names[String(log.patientId)] || 'the patient';
  const patients = youPatient ? 'your' : `${patient}'s`;
  const Patient = youPatient ? 'You' : patient;
  const their = youPatient ? 'your' : 'their';
  const doctor = log.doctorName || (typeof d.doctorId === 'string' ? names[d.doctorId] : '') || 'a doctor';
  const record = log.recordTitle || (d.fileName as string) || 'a report';
  const own = String(log.actorId) === String(log.patientId);
  switch (log.action) {
    case 'USER_LOGGED_IN':
      return { text: youAct ? 'You signed in' : `${actor} signed in`, category: 'login', status: 'Completed' };
    case 'USER_LOGGED_OUT':
      return { text: youAct ? 'You signed out' : `${actor} signed out`, category: 'login', status: 'Completed' };
    case 'LOGIN_FAILED':
      return { text: youAct ? 'A wrong password was entered for your account' : `Wrong password entered for ${actor}`, category: 'login', status: 'Failed' };
    case 'ACCOUNT_LOCKED':
      return { text: youAct ? 'Your account was locked after too many wrong passwords' : `${actor}'s account was locked after too many wrong passwords`, category: 'login', status: 'Failed' };
    case 'PASSWORD_CHANGED':
      return { text: youAct ? 'You changed your password' : `${actor} changed their password`, category: 'login', status: 'Completed' };
    case 'USER_REGISTERED':
      return { text: youAct ? 'Your account was created' : `${actor}'s account was created`, category: 'login', status: 'Completed' };
    case 'RECORD_UPLOADED_AND_ENCRYPTED':
      return { text: own ? `${actor} added ${record}` : `${actor} added ${record} to ${patients} record`, category: 'record', status: 'Verified' };
    case 'RECORD_DOWNLOADED':
      return { text: own ? `${actor} opened ${record}` : `${actor} opened ${youPatient ? 'your' : `${patient}'s`} ${record}`, category: 'record', status: 'Completed' };
    case 'RECORD_ACCESS_DENIED':
      return { text: `${actor} tried to open ${patients} ${record} without permission`, category: 'record', status: 'Failed' };
    case 'RECORD_TAMPER_DETECTED':
      return { text: `${record} failed its check — the file may have been changed`, category: 'verification', status: 'Failed' };
    case 'ACCESS_REQUESTED':
      return { text: `${actor} asked to see ${patients} records`, category: 'access', status: 'Pending' };
    case 'ACCESS_GRANTED':
    case 'GRANT_ACCESS':
      return { text: `${Patient} shared ${their} records with ${doctor}`, category: 'access', status: 'Active' };
    case 'ACCESS_REJECTED':
      return { text: `${Patient} declined ${doctor}'s request`, category: 'access', status: 'Revoked' };
    case 'ACCESS_REVOKED':
    case 'REVOKE_ACCESS':
      return { text: `${Patient} stopped sharing ${their} records with ${doctor}`, category: 'access', status: 'Revoked' };
    case 'ACCESS_OVERRIDE_GRANTED':
      return { text: `${actor} shared ${patients} records with ${doctor} in an emergency${typeof (d.consent as Record<string, unknown>)?.reason === 'string' ? ` — “${(d.consent as Record<string, string>).reason}”` : ''}`, category: 'access', status: 'Active' };
    case 'ACCESS_OVERRIDE_REVOKED':
      return { text: `${actor} stopped ${doctor} seeing ${patients} records${typeof (d.consent as Record<string, unknown>)?.reason === 'string' ? ` — “${(d.consent as Record<string, string>).reason}”` : ''}`, category: 'access', status: 'Revoked' };
    case 'RECORD_TEXT_CORRECTED':
      return { text: `${actor} corrected the text read from ${youPatient ? 'your' : `${patient}'s`} scanned report`, category: 'record', status: 'Completed' };
    case 'PRESCRIPTION_CREATED':
      return { text: `${actor} wrote a prescription for ${patient}`, category: 'record', status: 'Completed' };
    case 'PRESCRIPTION_STOPPED':
      return { text: `${actor} stopped a medicine for ${patient}`, category: 'record', status: 'Completed' };
    case 'RECORD_TEXT_EXTRACTED':
      return { text: `The text in ${record} was read, so it can be searched and explained`, category: 'record', status: 'Completed' };
    case 'AI_ANALYSIS':
      return { text: `${actor} used the AI assistant`, category: 'ai', status: 'Completed' };
    case 'WALLET_LINKED':
      return { text: youAct ? 'You linked your MetaMask wallet' : `${actor} linked a MetaMask wallet`, category: 'login', status: 'Completed' };
    case 'WALLET_UNLINKED':
      return { text: youAct ? 'You unlinked your MetaMask wallet' : `${actor} unlinked a MetaMask wallet`, category: 'login', status: 'Completed' };
    case 'PASSWORD_RESET_REQUESTED':
      return { text: 'A password reset link was requested', category: 'login', status: 'Completed' };
    case 'PASSWORD_RESET_COMPLETED':
      return { text: 'The password was reset', category: 'login', status: 'Completed' };
    case 'OTHER_SESSIONS_SIGNED_OUT':
      return { text: youAct ? 'You signed out your other devices' : `${actor} signed out other devices`, category: 'login', status: 'Completed' };
    case 'VITAL_DELETED':
      return { text: `${actor} deleted a reading`, category: 'record', status: 'Completed' };
    case 'VITAL_RECORDED':
      return { text: own ? `${actor} added a reading` : `${actor} added a reading for ${patient}`, category: 'record', status: 'Completed' };
    default:
      return { text: `${actor}: ${humanise(log.action || 'event')}`, category: 'admin', status: 'Completed' };
  }
};

export const auditLogToActivity = (log: AuditLog, index: number, names: NameLookup = {}, viewerId?: string): ActivityItem => {
  const meta = ACTION_META[log.action];
  const date = new Date(log.timestamp);
  const roleLabel = ROLE_LABEL[log.actorRole] || log.actorRole || 'System';
  const s = sentence(log, names, viewerId);
  const actorName = log.actorName || names[String(log.actorId)];
  return {
    id: `${log.blockchainEventHash || 'evt'}-${index}`,
    title: s.text,
    description: '',
    dateGroup: dateGroupFor(date),
    time: formatDateTime(date),
    at: date.toISOString(),
    category: s.category,
    status: s.status,
    actor: actorName ? `${actorName} (${roleLabel})` : roleLabel,
    actorRole: roleLabel,
    recordName: log.recordTitle || undefined,
    explanation: meta?.explanation || 'Every action on your records is kept in this history.',
    technicalDetails: log.blockchainEventHash
      ? {
          digitalFingerprint: log.blockchainEventHash,
          network: 'Record history',
          transactionHash: log.blockchainEventHash,
          blockNumber: 0
        }
      : undefined
  };
};

/**
 * Merges runs of the same event by the same person within 15 minutes ("signed in ×3"),
 * so the history is not a wall of repeats. Items must be newest first.
 */
export const mergeRepeats = (items: ActivityItem[]): ActivityItem[] => {
  const out: ActivityItem[] = [];
  for (const it of items) {
    const prev = out[out.length - 1];
    const close = prev && prev.at && it.at && Math.abs(new Date(prev.at).getTime() - new Date(it.at).getTime()) <= 15 * 60_000;
    if (prev && close && prev.title === it.title && prev.actor === it.actor) {
      prev.count = (prev.count || 1) + 1;
      continue;
    }
    out.push({ ...it });
  }
  return out.map((i) => (i.count && i.count > 1 ? { ...i, title: `${i.title} (${i.count} times)` } : i));
};

/** Tag shown on timeline cards. */
export const activityTag = (item: ActivityItem): string =>
  ({ record: 'REPORT', access: 'SHARING', verification: 'CHECK', login: 'SIGN-IN', ai: 'AI', admin: 'OTHER' })[item.category] || 'OTHER';

const RECORDS_PATH: Record<string, string> = {
  patient: '/patient/records',
  doctor: '/doctor/records',
  hospital: '/hospital/records',
  lab: '/lab/reports',
  insurance: '/insurance/verify',
  admin: '/admin/activity'
};

/** Builds the notification list for the signed-in user from live backend data. */
export const buildNotifications = (params: {
  role: string;
  userId: string;
  records: MedicalRecord[];
  consents?: Array<{
    status: string;
    doctorId: string;
    doctorName: string;
    patientName: string;
    patientId: string;
    requestedAt: string | null;
    decidedAt: string | null;
    override?: { byName: string; reason: string; at: string; change: 'granted' | 'revoked' } | null;
  }>;
}): NotificationItem[] => {
  const { role, userId, records, consents = [] } = params;
  const list: NotificationItem[] = [];
  const workspace = role === 'hospital-admin' ? 'hospital' : role === 'system-admin' ? 'admin' : role || 'patient';

  if (role === 'patient') {
    // an administrator changed who sees the patient's records (emergency override) — always tell them
    for (const c of consents.filter((x) => x.override)) {
      const o = c.override!;
      list.push({
        id: `override-${c.doctorId}-${o.at}`,
        title: o.change === 'granted' ? 'An administrator shared your records' : 'An administrator stopped a doctor seeing your records',
        message: `${o.byName} ${o.change === 'granted' ? 'let' : 'stopped'} ${c.doctorName} ${o.change === 'granted' ? 'see your records' : 'seeing your records'}. Reason given: “${o.reason}”. You can change this at any time.`,
        time: relativeTime(o.at),
        at: o.at,
        read: false,
        type: 'access_request',
        actionHref: '/patient/permissions',
        actionText: 'Review sharing'
      });
    }
    for (const c of consents.filter((x) => x.status === 'pending')) {
      list.push({
        id: `access-${c.doctorId}-${c.requestedAt}`,
        title: 'A doctor asked to see your records',
        message: `${c.doctorName} would like to see your records. Nothing is shared until you say yes.`,
        time: relativeTime(c.requestedAt || undefined),
        at: c.requestedAt || undefined,
        read: false,
        type: 'access_request',
        actionHref: '/patient/permissions',
        actionText: 'Answer'
      });
    }
  } else {
    for (const c of consents.filter((x) => x.status === 'granted' && x.decidedAt)) {
      list.push({
        id: `granted-${c.patientId}-${c.decidedAt}`,
        title: 'A patient shared their records',
        message: `${c.patientName} shared their records with you.`,
        time: relativeTime(c.decidedAt || undefined),
        at: c.decidedAt || undefined,
        read: false,
        type: 'access_request',
        actionHref: `/${workspace}/records`,
        actionText: 'See records'
      });
    }
  }

  // reports someone else added (your own uploads are not news to you)
  const recent = records
    .filter((r) => r.createdAt && String(r.uploadedBy) !== String(userId))
    .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())
    .slice(0, 5);
  for (const r of recent) {
    list.push({
      id: `record-${r.reportId}`,
      title: role === 'patient' ? 'New report in your record' : 'New report you can open',
      message: `${r.description || r.fileName} was added${role !== 'patient' && r.patientId ? '' : ''}.`,
      time: relativeTime(r.createdAt),
      at: new Date(r.createdAt as string).toISOString(),
      read: false,
      type: 'record_verified',
      actionHref: RECORDS_PATH[workspace] || `/${workspace}/dashboard`,
      actionText: 'Open'
    });
  }

  return list.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
};
