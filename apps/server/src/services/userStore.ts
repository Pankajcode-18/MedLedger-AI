import mongoose from 'mongoose';
import { seedDemoCollections } from './orgCollections.js';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { stateStore, IStoredUser } from '../models/stateStore.js';
import { config } from '../config/index.js';
import { encryptionService } from './encryptionService.js';
import { blockchainService } from './blockchainService.js';
import { UserRole } from '../types/index.js';

export type PublicUser = {
  id: string;
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  walletAddress?: string;
  /** true when walletAddress is the user's own MetaMask account (proved by a signature) */
  walletLinked?: boolean;
};

export type AdminUserView = PublicUser & { status: 'Active' | 'Disabled'; createdAt?: string; isDemo?: boolean };

const mongoReady = (): boolean => mongoose.connection.readyState === 1;

const normaliseEmail = (email: string): string => email.toLowerCase().trim();

const fromMongo = (doc: Record<string, unknown>): IStoredUser => ({
  userId: String(doc.userId),
  email: String(doc.email),
  role: String(doc.role),
  name: String(doc.name || ''),
  passwordHash: String(doc.passwordHash),
  phone: doc.phone ? String(doc.phone) : undefined,
  walletAddress: doc.walletAddress ? String(doc.walletAddress) : undefined,
  passwordChangedAt: doc.passwordChangedAt ? new Date(doc.passwordChangedAt as string).getTime() : undefined,
  createdAt: doc.createdAt ? new Date(doc.createdAt as string).toISOString() : undefined,
  disabled: Boolean(doc.disabled) || undefined
});

/**
 * Single source of truth for user accounts.
 * Uses MongoDB when it is connected and always mirrors to state.json,
 * so the app keeps working (and keeps its accounts) without a database.
 */
class UserStore {
  private dummyHash: string | null = null;

  public toPublic(user: IStoredUser): PublicUser {
    return {
      id: user.userId,
      userId: user.userId,
      email: user.email,
      role: user.role as UserRole,
      name: user.name,
      walletAddress: user.walletAddress || blockchainService.deriveAddress(user.userId),
      walletLinked: Boolean(user.walletVerifiedAt)
    };
  }

  /** The account whose verified MetaMask wallet is this address. */
  public findByWallet(address: string): IStoredUser | null {
    const target = address.toLowerCase();
    return (
      stateStore.getState().users?.find((u) => u.walletVerifiedAt && (u.walletAddress || '').toLowerCase() === target) || null
    );
  }

  /** Links a MetaMask address that the user has just proved they own. */
  public async linkWallet(userId: string, address: string): Promise<IStoredUser | null> {
    const user = stateStore.getState().users?.find((u) => String(u.userId) === String(userId));
    if (!user) return null;
    user.walletAddress = address;
    user.walletVerifiedAt = new Date().toISOString();
    this.syncDirectories(user);
    stateStore.saveState();
    await this.mirrorWallet(user);
    return user;
  }

  /** Goes back to the system-generated address used by the simulated ledger. */
  public async unlinkWallet(userId: string): Promise<IStoredUser | null> {
    const user = stateStore.getState().users?.find((u) => String(u.userId) === String(userId));
    if (!user) return null;
    user.walletAddress = blockchainService.deriveAddress(user.userId);
    delete user.walletVerifiedAt;
    this.syncDirectories(user);
    stateStore.saveState();
    await this.mirrorWallet(user);
    return user;
  }

  private syncDirectories(user: IStoredUser): void {
    const s = stateStore.getState();
    const p = s.patients.find((x) => String(x.patientId) === String(user.userId));
    if (p) p.ethereumAddress = user.walletAddress;
    const d = s.doctors.find((x) => String(x.doctorId) === String(user.userId));
    if (d) d.ethereumAddress = user.walletAddress;
  }

  private async mirrorWallet(user: IStoredUser): Promise<void> {
    if (!mongoReady()) return;
    try {
      await User.updateOne({ userId: user.userId }, { $set: { walletAddress: user.walletAddress } });
    } catch {
      // the state file stays the source of truth
    }
  }

  public async findByEmail(email: string): Promise<IStoredUser | null> {
    const target = normaliseEmail(email);
    if (mongoReady()) {
      try {
        const doc = await User.findOne({ email: target }).lean();
        if (doc) return fromMongo(doc as unknown as Record<string, unknown>);
      } catch {
        // fall through to the state file
      }
    }
    return stateStore.getState().users?.find((u) => normaliseEmail(u.email) === target) || null;
  }

  public async findById(userId: string): Promise<IStoredUser | null> {
    const target = String(userId);
    const local = stateStore.getState().users?.find((u) => String(u.userId) === target);
    if (local) return local;
    if (mongoReady()) {
      try {
        const doc = await User.findOne({ userId: target }).lean();
        if (doc) return fromMongo(doc as unknown as Record<string, unknown>);
      } catch {
        // ignore
      }
    }
    return null;
  }

  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.bcryptRounds);
  }

  public async verifyPassword(user: IStoredUser | null, password: string): Promise<boolean> {
    // Always run bcrypt, even for unknown emails, so response time does not reveal which emails exist.
    if (!this.dummyHash) this.dummyHash = bcrypt.hashSync('medledger-timing-equaliser', config.bcryptRounds);
    const hash = user?.passwordHash || this.dummyHash;
    try {
      const ok = await bcrypt.compare(password, hash);
      return Boolean(user) && ok;
    } catch {
      return false;
    }
  }

  public async create(params: {
    email: string;
    password: string;
    role: UserRole;
    name: string;
    phone?: string;
    userId?: string;
    isDemo?: boolean;
  }): Promise<IStoredUser> {
    const userId = params.userId || `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const user: IStoredUser = {
      userId,
      email: normaliseEmail(params.email),
      role: params.role,
      name: params.name.trim(),
      phone: params.phone || '',
      passwordHash: await this.hashPassword(params.password),
      walletAddress: blockchainService.deriveAddress(userId),
      passwordChangedAt: Math.floor(Date.now() / 1000) * 1000,
      createdAt: new Date().toISOString(),
      isDemo: params.isDemo || undefined
    };

    if (mongoReady() && !params.isDemo) {
      await new User({
        userId: user.userId,
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone,
        walletAddress: user.walletAddress,
        passwordHash: user.passwordHash,
        passwordChangedAt: new Date(user.passwordChangedAt as number),
        encryptionKey: encryptionService.generateKey()
      }).save();
    }

    const state = stateStore.getState();
    if (!state.users) state.users = [];
    state.users.push(user);
    stateStore.saveState();
    return user;
  }

  public async updatePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await this.hashPassword(newPassword);
    // Second precision so it compares cleanly with the JWT `iat` claim
    const passwordChangedAt = Math.floor(Date.now() / 1000) * 1000;

    if (mongoReady()) {
      try {
        await User.updateOne({ userId }, { $set: { passwordHash, passwordChangedAt: new Date(passwordChangedAt) } });
      } catch {
        // state file below is still updated
      }
    }

    const local = stateStore.getState().users?.find((u) => String(u.userId) === String(userId));
    if (local) {
      local.passwordHash = passwordHash;
      local.passwordChangedAt = passwordChangedAt;
    } else {
      const fromDb = await this.findById(userId);
      if (fromDb) {
        const state = stateStore.getState();
        if (!state.users) state.users = [];
        state.users.push({ ...fromDb, passwordHash, passwordChangedAt });
      }
    }
    stateStore.saveState();
  }

  /** Every account (MongoDB + state file, de-duplicated by userId), without password hashes. */
  public async listAll(): Promise<AdminUserView[]> {
    const byId = new Map<string, IStoredUser>();
    if (mongoReady()) {
      try {
        const docs = await User.find().lean();
        docs.forEach((d) => {
          const u = fromMongo(d as unknown as Record<string, unknown>);
          byId.set(u.userId, u);
        });
      } catch {
        // ignore
      }
    }
    (stateStore.getState().users || []).forEach((u) => {
      if (!byId.has(u.userId)) byId.set(u.userId, u);
    });
    return [...byId.values()].map((u) => ({
      ...this.toPublic(u),
      status: u.disabled ? 'Disabled' : 'Active',
      createdAt: u.createdAt,
      isDemo: u.isDemo
    }));
  }

  public async setDisabled(userId: string, disabled: boolean): Promise<boolean> {
    let found = false;
    if (mongoReady()) {
      try {
        const r = await User.updateOne({ userId }, { $set: { disabled } });
        found = r.matchedCount > 0;
      } catch {
        // ignore
      }
    }
    const local = stateStore.getState().users?.find((u) => String(u.userId) === String(userId));
    if (local) {
      local.disabled = disabled || undefined;
      found = true;
      stateStore.saveState();
    }
    return found;
  }

  /**
   * Creates the demo accounts shown on the login page as real bcrypt-hashed users.
   * Existing accounts are never overwritten.
   */
  public async seedDemoAccounts(): Promise<number> {
    if (!config.demoAccounts) return 0;
    const demo = DEMO_ACCOUNTS;

    const state = stateStore.getState();
    if (!state.users) state.users = [];
    let created = 0;
    // earlier versions used other sample names and addresses: rename those demo accounts in place
    let renamed = 0;
    for (const d of demo) {
      const old = state.users.find((u) => u.isDemo && u.userId === d.userId && normaliseEmail(u.email) !== d.email);
      if (old && !state.users.some((u) => normaliseEmail(u.email) === d.email)) {
        old.email = d.email;
        old.name = d.name;
        renamed++;
      }
    }
    const legacyPatient = state.patients.find((p) => p.patientId === '90' && p.email === '123@gmail.com');
    if (legacyPatient) {
      legacyPatient.email = 'patient@medledger.demo';
      renamed++;
    }
    const legacyDoctor = state.doctors.find((doc) => doc.doctorId === '1593418229676');
    if (legacyDoctor && /house/i.test(legacyDoctor.name)) {
      legacyDoctor.name = 'Dr. Anil Sharma';
      legacyDoctor.email = 'doctor@medledger.demo';
      legacyDoctor.licenseId = 'NMC-10293';
      renamed++;
    }
    for (const d of demo) {
      const exists = state.users.some((u) => normaliseEmail(u.email) === d.email);
      if (exists) continue;
      state.users.push({
        userId: d.userId,
        email: d.email,
        role: d.role,
        name: d.name,
        passwordHash: await this.hashPassword(d.password),
        walletAddress:
          state.patients.find((p) => p.patientId === d.userId)?.ethereumAddress ||
          state.doctors.find((doc) => doc.doctorId === d.userId)?.ethereumAddress ||
          blockchainService.deriveAddress(d.userId),
        passwordChangedAt: 0,
        createdAt: new Date().toISOString(),
        isDemo: true
      });
      created++;
    }
    if (created > 0 || renamed > 0) stateStore.saveState();
    seedDemoCollections();
    return created;
  }
}

/** Sample accounts for trying the system (DEMO_ACCOUNTS=true). Names and places are invented. */
export const DEMO_ACCOUNTS: Array<{ userId: string; email: string; password: string; role: UserRole; name: string }> = [
  { userId: '90', email: 'patient@medledger.demo', password: 'secret99', role: 'patient', name: 'Tanmay Shishodia' },
  { userId: '1593418229676', email: 'doctor@medledger.demo', password: 'secret99', role: 'doctor', name: 'Dr. Anil Sharma' },
  { userId: 'hosp-01', email: 'hospital@medledger.demo', password: 'hospital123', role: 'hospital-admin', name: 'Himal Care Hospital' },
  { userId: 'lab-01', email: 'lab@medledger.demo', password: 'lab123', role: 'lab', name: 'Himal Diagnostic Lab' },
  { userId: 'ins-01', email: 'insurance@medledger.demo', password: 'insurance123', role: 'insurance', name: 'Suraksha Health Insurance' },
  { userId: 'admin-01', email: 'admin@medledger.demo', password: 'admin123', role: 'admin', name: 'MedLedger Administrator' }
];

export const userStore = new UserStore();
