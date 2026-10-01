import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { recordVault } from '../services/recordVault.js';
import { IPatientRecord, IDoctorRecord, IMedicalReport, IBlockchainBlock, IAuditLogEntry, IVitalReading, IChatThread, IUserSettings, IPrescription, IConsent } from '../types/index.js';

export interface IStateData {
  patients: IPatientRecord[];
  doctors: IDoctorRecord[];
  reports: IMedicalReport[];
  blocks: IBlockchainBlock[];
  auditLogs?: IAuditLogEntry[];
  /** Home and clinic measurements (encrypted at rest as one sealed blob). */
  vitals?: IVitalReading[];
  /** Assistant conversations (encrypted at rest as one sealed blob). */
  chats?: IChatThread[];
  /** Saved settings forms (encrypted at rest; profiles hold contact and emergency details). */
  settings?: IUserSettings[];
  /** Prescriptions (encrypted at rest). */
  prescriptions?: IPrescription[];
  /** Hospital staff, admissions, lab samples, insurance claims, policyholders and organisations (encrypted at rest). */
  staff?: Array<Record<string, unknown>>;
  admissions?: Array<Record<string, unknown>>;
  samples?: Array<Record<string, unknown>>;
  claims?: Array<Record<string, unknown>>;
  policyholders?: Array<Record<string, unknown>>;
  organisations?: Array<Record<string, unknown>>;
  /** Patient → doctor permissions (encrypted at rest). */
  consents?: IConsent[];
  users?: IStoredUser[];
  /** JWT ids revoked by logout, kept until the token would have expired anyway. */
  revokedTokens?: Array<{ jti: string; exp: number }>;
  /** Signed-in sessions (one per issued token) so users can see and end them. */
  sessions?: Array<{ jti: string; userId: string; userAgent: string; ip: string; createdAt: number; exp: number }>;
  /** Pending password-reset requests (only a SHA-256 of the token is stored). */
  passwordResets?: Array<{ userId: string; tokenHash: string; expiresAt: number }>;
}

export interface IStoredUser {
  userId: string;
  email: string;
  role: string;
  name: string;
  passwordHash: string;
  phone?: string;
  walletAddress?: string;
  /** Set when the user proved ownership of walletAddress by signing with MetaMask. */
  walletVerifiedAt?: string;
  /** Epoch ms; tokens issued before this moment are rejected. */
  passwordChangedAt?: number;
  createdAt?: string;
  isDemo?: boolean;
  /** Disabled accounts cannot sign in and their existing tokens stop working. */
  disabled?: boolean;
}

/**
 * Writes are coalesced: every change marks the state dirty and one background write follows within
 * STATE_SAVE_DELAY_MS (default 100 ms), however many changes happened meanwhile. Before this, every
 * audit entry and every upload rewrote the whole file synchronously — 84% of server CPU under load.
 * flush() waits for pending writes (used by shutdown and tests); on exit a pending write is done
 * synchronously so nothing is lost on a normal stop.
 */
const SAVE_DELAY_MS = Math.max(0, parseInt(process.env.STATE_SAVE_DELAY_MS || '100', 10) || 0);

class StateStore {
  private stateFilePath: string;
  /** Audit entries are appended here (one encrypted line each) instead of rewriting the state file. */
  private auditFilePath: string;
  private memoryState: IStateData;
  private dirty = false;
  private saveTimer: NodeJS.Timeout | null = null;
  private writing: Promise<void> | null = null;
  private auditQueue: Promise<void> = Promise.resolve();
  /** Encrypted audit lines not yet on disk. */
  private auditPending: string[] = [];

  constructor() {
    this.stateFilePath = config.stateFilePath;
    this.auditFilePath = `${this.stateFilePath}.audit`;
    this.memoryState = this.loadState();
    // a normal stop writes whatever is still pending, synchronously
    process.once('exit', () => {
      if (this.auditPending.length) {
        try {
          fs.appendFileSync(this.auditFilePath, this.auditPending.splice(0).join(''), { mode: 0o600 });
        } catch {
          /* nothing more can be done while exiting */
        }
      }
      if (this.dirty || this.saveTimer) this.saveStateSync();
    });
  }

  public loadState(): IStateData {
    if (fs.existsSync(this.stateFilePath)) {
      try {
        const raw = fs.readFileSync(this.stateFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed.patients) parsed.patients = [];
        if (!parsed.doctors) parsed.doctors = [];
        if (!parsed.reports) parsed.reports = [];
        if (!parsed.blocks) parsed.blocks = [];
        if (!parsed.auditLogs) parsed.auditLogs = [];
        if (!parsed.users) parsed.users = [];
        this.openSealedNotes(parsed.reports as Array<IMedicalReport & Record<string, unknown>>);
        for (const name of StateStore.SEALED_LISTS) {
          parsed[name] = this.openSealedList(parsed[`${name}Sealed`], name) ?? parsed[name] ?? [];
          delete parsed[`${name}Sealed`];
        }
        // older state files kept the audit trail inline: move it to the append-only audit file once
        const inline = parsed.auditLogs as IAuditLogEntry[];
        parsed.auditLogs = [...this.readAuditFile(), ...inline];
        this.memoryState = parsed;
        if (inline.length) {
          for (const e of inline) fs.appendFileSync(this.auditFilePath, `${this.sealAudit(e)}\n`, { mode: 0o600 });
          this.saveStateSync();
        }
        return parsed;
      } catch (err) {
        console.error('[StateStore] Error reading state.json:', err);
      }
    }

    // Default baseline fallback state
    this.memoryState = {
      patients: [
        {
          patientId: '90',
          adharNo: 'XXXXXXXXXXXX',
          name: 'tanmay shishodia',
          email: 'patient@medledger.demo',
          age: '24',
          phNo: 'XXXXXXXXXX',
          address: 'XXXXXXXXXX',
          city: 'XXXXXXX',
          reportFile: 'hp9.docx',
          ethereumAddress: '0x495e7483db248DCA08B37121D15917Ae19D93C20',
          type: 'patient'
        }
      ],
      doctors: [
        {
          doctorId: '1593418229676',
          licenseId: 'NMC-10293',
          name: 'Dr. Anil Sharma',
          email: 'doctor@medledger.demo',
          age: '45',
          phNo: '+977 9841000000',
          ethereumAddress: '0x1593418229676000000000000000000000000000',
          type: 'doctor'
        }
      ],
      reports: [
        {
          reportId: '1593418802454',
          patientId: '90',
          report:
            'Diagnostic Assessment for tanmay shishodia: Patient vitals stable. Blood Pressure 120/80 mmHg, SpO2 99%.',
          fileName: 'hp9.docx',
          fileHash: '0x04a21f8828d1556e472ac7c4474fb99ad8fb873121ea69cfdc618d17284d5095',
          isAsked: '1',
          isGiven: '0',
          type: 'report'
        }
      ],
      blocks: [],
      auditLogs: [],
      users: []
    };
    return this.memoryState;
  }

  /** Lists stored as one encrypted blob each (`<name>Sealed` on disk). */
  public static readonly SEALED_LISTS = [
    'vitals',
    'chats',
    'settings',
    'prescriptions',
    'staff',
    'admissions',
    'samples',
    'claims',
    'policyholders',
    'organisations',
    'consents'
  ] as const;

  /** Encrypted-at-rest report fields and the context each is bound to. */
  private static readonly SEALED_FIELDS = [
    { field: 'report', sealedAs: 'reportSealed', context: 'notes' },
    { field: 'extractedText', sealedAs: 'extractedTextSealed', context: 'extracted' }
  ] as const;

  /** `${field}:${reportId}` → last sealed value, so unchanged text is not re-encrypted on every save */
  private sealedCache = new Map<string, { plain: string; sealed: string }>();

  private sealNotes(r: IMedicalReport): Record<string, unknown> {
    const out: Record<string, unknown> = { ...r };
    for (const { field, sealedAs, context } of StateStore.SEALED_FIELDS) {
      const plain = r[field];
      delete out[field];
      if (!plain) continue;
      const key = `${field}:${r.reportId}`;
      const hit = this.sealedCache.get(key);
      let sealed = hit && hit.plain === plain ? hit.sealed : '';
      if (!sealed) {
        try {
          sealed = recordVault.sealText(plain, `${context}:${r.reportId}`);
          this.sealedCache.set(key, { plain, sealed });
        } catch (err) {
          // never fall back to writing plaintext
          console.error(`[StateStore] Could not encrypt ${field}; it is kept in memory only:`, (err as Error).message);
          continue;
        }
      }
      out[sealedAs] = sealed;
    }
    return out;
  }

  private openSealedNotes(reports: Array<IMedicalReport & Record<string, unknown>>): void {
    for (const r of reports) {
      for (const { field, sealedAs, context } of StateStore.SEALED_FIELDS) {
        const sealed = r[sealedAs] as string | undefined;
        if (!sealed) continue;
        try {
          r[field] = recordVault.openText(sealed, `${context}:${r.reportId}`);
          this.sealedCache.set(`${field}:${r.reportId}`, { plain: r[field] as string, sealed });
        } catch (err) {
          console.error(`[StateStore] Could not decrypt ${field} of record ${r.reportId}:`, (err as Error).message);
          r[field] = '';
        }
        delete r[sealedAs];
      }
    }
  }

  private sealedListCache = new Map<string, { json: string; sealed: string }>();

  private sealList(list: unknown[] | undefined, context: string): string | undefined {
    if (!list || !list.length) return undefined;
    const json = JSON.stringify(list);
    const hit = this.sealedListCache.get(context);
    if (hit && hit.json === json) return hit.sealed;
    try {
      const sealed = recordVault.sealText(json, `list:${context}`);
      this.sealedListCache.set(context, { json, sealed });
      return sealed;
    } catch (err) {
      // never fall back to plaintext on disk
      console.error(`[StateStore] Could not encrypt ${context}; kept in memory only:`, (err as Error).message);
      return undefined;
    }
  }

  private openSealedList<T>(sealed: unknown, context: string): T[] | undefined {
    if (typeof sealed !== 'string' || !sealed) return undefined;
    try {
      const json = recordVault.openText(sealed, `list:${context}`);
      this.sealedListCache.set(context, { json, sealed });
      return JSON.parse(json) as T[];
    } catch (err) {
      console.error(`[StateStore] Could not decrypt ${context}:`, (err as Error).message);
      return [];
    }
  }

  /** Re-wraps every note key with the current master key (see scripts/rotate-keys.ts). */
  public rewrapSealedNotes(): number {
    this.sealedCache.clear();
    this.sealedListCache.clear();
    this.saveStateSync();
    this.rewrapAuditFile();
    return this.memoryState.reports.filter((r) => r.report).length;
  }

  public getState(): IStateData {
    return this.memoryState;
  }

  private sealAudit(entry: IAuditLogEntry): string {
    return recordVault.sealText(JSON.stringify(entry), 'audit');
  }

  /** Entries from the append-only audit file (a damaged or foreign line is skipped, not fatal). */
  private readAuditFile(): IAuditLogEntry[] {
    if (!fs.existsSync(this.auditFilePath)) return [];
    const out: IAuditLogEntry[] = [];
    for (const line of fs.readFileSync(this.auditFilePath, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(recordVault.openText(line.trim(), 'audit')) as IAuditLogEntry;
        e.timestamp = new Date(e.timestamp);
        out.push(e);
      } catch {
        console.warn('[StateStore] An audit line could not be read and was skipped.');
      }
    }
    return out;
  }

  /** Re-encrypts every audit line under the current master key (used by key rotation). */
  public rewrapAuditFile(): number {
    const entries = this.memoryState.auditLogs || [];
    const tmp = `${this.auditFilePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, entries.map((e) => `${this.sealAudit(e)}\n`).join(''), { mode: 0o600 });
    fs.renameSync(tmp, this.auditFilePath);
    return entries.length;
  }

  /** The state as written to disk: notes and personal lists sealed, the audit trail kept in its own file. */
  private serialise(): string {
    const rest: Record<string, unknown> = { ...this.memoryState };
    delete rest.auditLogs;
    for (const name of StateStore.SEALED_LISTS) delete rest[name];
    const onDisk: Record<string, unknown> = { ...rest, reports: this.memoryState.reports.map((r) => this.sealNotes(r)) };
    // health data, contacts and claims are stored only encrypted
    for (const name of StateStore.SEALED_LISTS) {
      const sealed = this.sealList(this.memoryState[name] as unknown[] | undefined, name);
      if (sealed) onDisk[`${name}Sealed`] = sealed;
    }
    return JSON.stringify(onDisk, null, 2);
  }

  /** Marks the state changed; one write follows shortly (see SAVE_DELAY_MS). */
  public saveState(): void {
    this.dirty = true;
    if (SAVE_DELAY_MS === 0) {
      this.saveStateSync();
      return;
    }
    if (!this.saveTimer) {
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        void this.writeNow();
      }, SAVE_DELAY_MS);
      this.saveTimer.unref();
    }
  }

  private async writeNow(): Promise<void> {
    if (this.writing) await this.writing.catch(() => undefined);
    if (!this.dirty) return;
    this.dirty = false;
    const data = this.serialise();
    const tmp = `${this.stateFilePath}.${process.pid}.tmp`;
    this.writing = (async () => {
      await fs.promises.mkdir(path.dirname(this.stateFilePath), { recursive: true });
      await fs.promises.writeFile(tmp, data, { encoding: 'utf8', mode: 0o600 });
      await fs.promises.rename(tmp, this.stateFilePath);
    })()
      .catch((err) => {
        this.dirty = true; // try again with the next change or flush
        console.error('[StateStore] Error saving state.json:', err);
      })
      .finally(() => {
        this.writing = null;
      });
    await this.writing;
  }

  /** Waits until every pending change (state and audit trail) is on disk. */
  public async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.auditQueue;
    await this.writeNow();
    if (this.writing) await this.writing;
  }

  /** Immediate synchronous write (start-up migration and process exit). */
  public saveStateSync(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    try {
      fs.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
      const tmp = `${this.stateFilePath}.${process.pid}.sync.tmp`;
      fs.writeFileSync(tmp, this.serialise(), { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tmp, this.stateFilePath);
      this.dirty = false;
    } catch (err) {
      console.error('[StateStore] Error saving state.json:', err);
    }
  }

  public addPatient(patient: IPatientRecord): void {
    this.memoryState.patients.push(patient);
    this.saveState();
  }

  public addDoctor(doctor: IDoctorRecord): void {
    this.memoryState.doctors.push(doctor);
    this.saveState();
  }

  public addReport(report: IMedicalReport): void {
    this.memoryState.reports.push(report);
    this.saveState();
  }

  public updateReport(reportId: string, updates: Partial<IMedicalReport>): boolean {
    const r = this.memoryState.reports.find((item) => item.reportId === reportId);
    if (r) {
      Object.assign(r, updates);
      this.saveState();
      return true;
    }
    return false;
  }

  public addBlock(block: IBlockchainBlock): void {
    this.memoryState.blocks.push(block);
    this.saveState();
  }

  public addAuditLog(entry: IAuditLogEntry): void {
    if (!this.memoryState.auditLogs) this.memoryState.auditLogs = [];
    this.memoryState.auditLogs.push(entry);
    // appended in order, one short encrypted line each — no rewrite of the whole state
    this.auditPending.push(`${this.sealAudit(entry)}\n`);
    this.auditQueue = this.auditQueue
      .then(async () => {
        const lines = this.auditPending.splice(0);
        if (lines.length) await fs.promises.appendFile(this.auditFilePath, lines.join(''), { mode: 0o600 });
      })
      .catch((err) => console.error('[StateStore] Error writing the audit trail:', err));
  }
}

export const stateStore = new StateStore();
