import { stateStore } from '../models/stateStore.js';
import { blockchainService } from './blockchainService.js';
import { auditService } from './auditService.js';
import { IConsent, UserRole } from '../types/index.js';

/**
 * Evidence that the patient themselves approved a consent change:
 *  - 'session'   : signed-in patient clicked the button (the default flow)
 *  - 'signature' : patient signed an EIP-712 consent message in MetaMask
 *  - 'onchain'   : patient sent the grant/revoke transaction to the HealthRecords contract
 */
export interface ConsentEvidence {
  /** admin-override = an administrator changed the permission for the patient (break-glass; reason required). */
  method: 'session' | 'signature' | 'onchain' | 'admin-override';
  /** Why an administrator changed the permission (admin-override only; kept in the audit log, not on-chain). */
  reason?: string;
  overrideBy?: string;
  wallet?: string;
  signature?: string;
  txHash?: string;
  chainId?: number;
  blockNumber?: number;
}

interface Actor {
  userId: string;
  role: string;
}

export class ConsentError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const list = (): IConsent[] => {
  const state = stateStore.getState();
  if (!state.consents) state.consents = [];
  return state.consents;
};

const now = () => new Date().toISOString();

/**
 * Lookup index over the consent list (patient|doctor → entry, and each doctor's granted patients),
 * rebuilt only when entries are added or the list is replaced; status changes are made on the entries
 * themselves, so the index stays correct without a rebuild. Before this, every record in a doctor's
 * list scanned the whole consent list.
 */
let indexed: { list: IConsent[]; size: number; byPair: Map<string, IConsent>; byDoctor: Map<string, IConsent[]> } | null = null;
const index = () => {
  const l = list();
  if (indexed && indexed.list === l && indexed.size === l.length) return indexed;
  const byPair = new Map<string, IConsent>();
  const byDoctor = new Map<string, IConsent[]>();
  for (const c of l) {
    byPair.set(`${c.patientId}|${c.doctorId}`, c);
    const d = byDoctor.get(c.doctorId);
    if (d) d.push(c);
    else byDoctor.set(c.doctorId, [c]);
  }
  indexed = { list: l, size: l.length, byPair, byDoctor };
  return indexed;
};

/**
 * Older data kept permission only as `authorizedUsers` on each report and an `isAsked` flag.
 * Turn that into consent entries once, so nothing that was shared before is lost.
 */
const migrateLegacy = (): void => {
  const state = stateStore.getState();
  if (state.consents && state.consents.length) return;
  const found = new Map<string, IConsent>();
  for (const r of state.reports) {
    for (const id of r.authorizedUsers || []) {
      if (id === r.patientId || id === r.uploadedBy) continue;
      found.set(`${r.patientId}|${id}`, { patientId: r.patientId, doctorId: id, status: 'granted', updatedAt: now(), decidedAt: now() });
    }
    // the original single-doctor demo flow: an open request from the demo doctor
    if (r.isAsked === '1' && !found.has(`${r.patientId}|1593418229676`)) {
      found.set(`${r.patientId}|1593418229676`, { patientId: r.patientId, doctorId: '1593418229676', status: 'pending', requestedAt: now(), updatedAt: now() });
    }
  }
  if (found.size) {
    state.consents = [...found.values()];
    stateStore.saveState();
  }
};

/** Put the doctor on (or take them off) every report of the patient, so `authorizedUsers` always matches the consent. */
const syncReports = (patientId: string, doctorId: string, allowed: boolean): void => {
  for (const r of stateStore.getState().reports) {
    if (r.patientId !== patientId) continue;
    const users = new Set(r.authorizedUsers || []);
    users.add(patientId);
    if (allowed) users.add(doctorId);
    else users.delete(doctorId);
    r.authorizedUsers = [...users];
    // the old flags follow the consent too, for anything still reading them
    r.isGiven = allowed ? '1' : '0';
    r.isAsked = '0';
  }
};

/** The override note kept on a consent entry so the patient is told; cleared by the patient's next decision. */
const overrideOf = (evidence: ConsentEvidence, change: 'granted' | 'revoked'): IConsent['override'] =>
  evidence.method === 'admin-override'
    ? { by: String(evidence.overrideBy || ''), reason: String(evidence.reason || ''), at: now(), change }
    : undefined;

/** The one place patient → doctor access is asked for, granted, declined or removed. */
export const consentService = {
  find(patientId: string, doctorId: string): IConsent | undefined {
    migrateLegacy();
    return index().byPair.get(`${String(patientId)}|${String(doctorId)}`);
  },

  forPatient(patientId: string): IConsent[] {
    migrateLegacy();
    return list().filter((c) => c.patientId === String(patientId));
  },

  forDoctor(doctorId: string): IConsent[] {
    migrateLegacy();
    return [...(index().byDoctor.get(String(doctorId)) || [])];
  },

  /** Patients who currently share their records with this doctor (one lookup per request, not per record). */
  grantedPatients(doctorId: string): Set<string> {
    migrateLegacy();
    return new Set((index().byDoctor.get(String(doctorId)) || []).filter((c) => c.status === 'granted').map((c) => c.patientId));
  },

  isGranted(patientId: string, doctorId: string): boolean {
    return this.find(patientId, doctorId)?.status === 'granted';
  },

  /** Doctors this patient currently shares with. */
  grantedDoctors(patientId: string): string[] {
    return this.forPatient(patientId)
      .filter((c) => c.status === 'granted')
      .map((c) => c.doctorId);
  },

  async request(patientId: string, doctorId: string, actor: Actor, reason?: string): Promise<IConsent> {
    const existing = this.find(patientId, doctorId);
    if (existing?.status === 'granted') throw new ConsentError('This patient already shares their records with you.', 409);
    const entry: IConsent = existing || { patientId: String(patientId), doctorId: String(doctorId), status: 'pending', updatedAt: now() };
    Object.assign(entry, { status: 'pending', reason: reason?.trim() || undefined, requestedAt: now(), decidedAt: undefined, updatedAt: now() });
    if (!existing) list().push(entry);
    stateStore.saveState();
    await auditService.logEvent({
      patientId,
      actorId: actor.userId,
      actorRole: actor.role as UserRole,
      action: 'ACCESS_REQUESTED',
      details: { doctorId, patientId }
    });
    return entry;
  },

  async grant(patientId: string, doctorId: string, actor: Actor, evidence: ConsentEvidence = { method: 'session' }) {
    const existing = this.find(patientId, doctorId);
    const entry: IConsent = existing || { patientId: String(patientId), doctorId: String(doctorId), status: 'granted', updatedAt: now() };
    Object.assign(entry, { status: 'granted', decidedAt: now(), updatedAt: now(), override: overrideOf(evidence, 'granted') });
    if (!existing) list().push(entry);
    syncReports(String(patientId), String(doctorId), true);
    stateStore.saveState();
    const ledgerTx = await blockchainService.grantAccess(patientId, doctorId, evidence);
    await auditService.logEvent({
      patientId,
      actorId: actor.userId,
      actorRole: actor.role as UserRole,
      action: evidence.method === 'admin-override' ? 'ACCESS_OVERRIDE_GRANTED' : 'ACCESS_GRANTED',
      blockchainEventHash: evidence.txHash || ledgerTx,
      details: { doctorId, patientId, consent: evidence }
    });
    return { ledgerTx, consent: entry };
  },

  async decline(patientId: string, doctorId: string, actor: Actor): Promise<IConsent> {
    const entry = this.find(patientId, doctorId);
    if (!entry || entry.status !== 'pending') throw new ConsentError('There is no open request from this doctor.', 404);
    Object.assign(entry, { status: 'declined', decidedAt: now(), updatedAt: now(), override: undefined });
    stateStore.saveState();
    await auditService.logEvent({
      patientId,
      actorId: actor.userId,
      actorRole: actor.role as UserRole,
      action: 'ACCESS_REJECTED',
      details: { doctorId, patientId }
    });
    return entry;
  },

  async revoke(patientId: string, doctorId: string, actor: Actor, evidence: ConsentEvidence = { method: 'session' }) {
    const existing = this.find(patientId, doctorId);
    const entry: IConsent = existing || { patientId: String(patientId), doctorId: String(doctorId), status: 'revoked', updatedAt: now() };
    Object.assign(entry, { status: 'revoked', decidedAt: now(), updatedAt: now(), override: overrideOf(evidence, 'revoked') });
    if (!existing) list().push(entry);
    syncReports(String(patientId), String(doctorId), false);
    stateStore.saveState();
    const ledgerTx = await blockchainService.revokeAccess(patientId, doctorId, evidence);
    await auditService.logEvent({
      patientId,
      actorId: actor.userId,
      actorRole: actor.role as UserRole,
      action: evidence.method === 'admin-override' ? 'ACCESS_OVERRIDE_REVOKED' : 'ACCESS_REVOKED',
      blockchainEventHash: evidence.txHash || ledgerTx,
      details: { doctorId, patientId, consent: evidence }
    });
    return { ledgerTx, consent: entry };
  },

  /** A new report inherits the patient's current permissions. */
  authorizedFor(patientId: string): string[] {
    return [String(patientId), ...this.grantedDoctors(patientId)];
  }
};
