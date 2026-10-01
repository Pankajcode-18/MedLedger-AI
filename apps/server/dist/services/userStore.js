"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userStore = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_js_1 = require("../models/User.js");
const stateStore_js_1 = require("../models/stateStore.js");
const index_js_1 = require("../config/index.js");
const encryptionService_js_1 = require("./encryptionService.js");
const blockchainService_js_1 = require("./blockchainService.js");
const mongoReady = () => mongoose_1.default.connection.readyState === 1;
const normaliseEmail = (email) => email.toLowerCase().trim();
const fromMongo = (doc) => ({
    userId: String(doc.userId),
    email: String(doc.email),
    role: String(doc.role),
    name: String(doc.name || ''),
    passwordHash: String(doc.passwordHash),
    phone: doc.phone ? String(doc.phone) : undefined,
    walletAddress: doc.walletAddress ? String(doc.walletAddress) : undefined,
    passwordChangedAt: doc.passwordChangedAt ? new Date(doc.passwordChangedAt).getTime() : undefined,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    disabled: Boolean(doc.disabled) || undefined
});
/**
 * Single source of truth for user accounts.
 * Uses MongoDB when it is connected and always mirrors to state.json,
 * so the app keeps working (and keeps its accounts) without a database.
 */
class UserStore {
    dummyHash = null;
    toPublic(user) {
        return {
            id: user.userId,
            userId: user.userId,
            email: user.email,
            role: user.role,
            name: user.name,
            walletAddress: user.walletAddress || blockchainService_js_1.blockchainService.deriveAddress(user.userId),
            walletLinked: Boolean(user.walletVerifiedAt)
        };
    }
    /** The account whose verified MetaMask wallet is this address. */
    findByWallet(address) {
        const target = address.toLowerCase();
        return (stateStore_js_1.stateStore.getState().users?.find((u) => u.walletVerifiedAt && (u.walletAddress || '').toLowerCase() === target) || null);
    }
    /** Links a MetaMask address that the user has just proved they own. */
    async linkWallet(userId, address) {
        const user = stateStore_js_1.stateStore.getState().users?.find((u) => String(u.userId) === String(userId));
        if (!user)
            return null;
        user.walletAddress = address;
        user.walletVerifiedAt = new Date().toISOString();
        this.syncDirectories(user);
        stateStore_js_1.stateStore.saveState();
        await this.mirrorWallet(user);
        return user;
    }
    /** Goes back to the system-generated address used by the simulated ledger. */
    async unlinkWallet(userId) {
        const user = stateStore_js_1.stateStore.getState().users?.find((u) => String(u.userId) === String(userId));
        if (!user)
            return null;
        user.walletAddress = blockchainService_js_1.blockchainService.deriveAddress(user.userId);
        delete user.walletVerifiedAt;
        this.syncDirectories(user);
        stateStore_js_1.stateStore.saveState();
        await this.mirrorWallet(user);
        return user;
    }
    syncDirectories(user) {
        const s = stateStore_js_1.stateStore.getState();
        const p = s.patients.find((x) => String(x.patientId) === String(user.userId));
        if (p)
            p.ethereumAddress = user.walletAddress;
        const d = s.doctors.find((x) => String(x.doctorId) === String(user.userId));
        if (d)
            d.ethereumAddress = user.walletAddress;
    }
    async mirrorWallet(user) {
        if (!mongoReady())
            return;
        try {
            await User_js_1.User.updateOne({ userId: user.userId }, { $set: { walletAddress: user.walletAddress } });
        }
        catch {
            // the state file stays the source of truth
        }
    }
    async findByEmail(email) {
        const target = normaliseEmail(email);
        if (mongoReady()) {
            try {
                const doc = await User_js_1.User.findOne({ email: target }).lean();
                if (doc)
                    return fromMongo(doc);
            }
            catch {
                // fall through to the state file
            }
        }
        return stateStore_js_1.stateStore.getState().users?.find((u) => normaliseEmail(u.email) === target) || null;
    }
    async findById(userId) {
        const target = String(userId);
        const local = stateStore_js_1.stateStore.getState().users?.find((u) => String(u.userId) === target);
        if (local)
            return local;
        if (mongoReady()) {
            try {
                const doc = await User_js_1.User.findOne({ userId: target }).lean();
                if (doc)
                    return fromMongo(doc);
            }
            catch {
                // ignore
            }
        }
        return null;
    }
    async hashPassword(password) {
        return bcryptjs_1.default.hash(password, index_js_1.config.bcryptRounds);
    }
    async verifyPassword(user, password) {
        // Always run bcrypt, even for unknown emails, so response time does not reveal which emails exist.
        if (!this.dummyHash)
            this.dummyHash = bcryptjs_1.default.hashSync('medledger-timing-equaliser', index_js_1.config.bcryptRounds);
        const hash = user?.passwordHash || this.dummyHash;
        try {
            const ok = await bcryptjs_1.default.compare(password, hash);
            return Boolean(user) && ok;
        }
        catch {
            return false;
        }
    }
    async create(params) {
        const userId = params.userId || `${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const user = {
            userId,
            email: normaliseEmail(params.email),
            role: params.role,
            name: params.name.trim(),
            phone: params.phone || '',
            passwordHash: await this.hashPassword(params.password),
            walletAddress: blockchainService_js_1.blockchainService.deriveAddress(userId),
            passwordChangedAt: Math.floor(Date.now() / 1000) * 1000,
            createdAt: new Date().toISOString(),
            isDemo: params.isDemo || undefined
        };
        if (mongoReady() && !params.isDemo) {
            await new User_js_1.User({
                userId: user.userId,
                email: user.email,
                role: user.role,
                name: user.name,
                phone: user.phone,
                walletAddress: user.walletAddress,
                passwordHash: user.passwordHash,
                passwordChangedAt: new Date(user.passwordChangedAt),
                encryptionKey: encryptionService_js_1.encryptionService.generateKey()
            }).save();
        }
        const state = stateStore_js_1.stateStore.getState();
        if (!state.users)
            state.users = [];
        state.users.push(user);
        stateStore_js_1.stateStore.saveState();
        return user;
    }
    async updatePassword(userId, newPassword) {
        const passwordHash = await this.hashPassword(newPassword);
        // Second precision so it compares cleanly with the JWT `iat` claim
        const passwordChangedAt = Math.floor(Date.now() / 1000) * 1000;
        if (mongoReady()) {
            try {
                await User_js_1.User.updateOne({ userId }, { $set: { passwordHash, passwordChangedAt: new Date(passwordChangedAt) } });
            }
            catch {
                // state file below is still updated
            }
        }
        const local = stateStore_js_1.stateStore.getState().users?.find((u) => String(u.userId) === String(userId));
        if (local) {
            local.passwordHash = passwordHash;
            local.passwordChangedAt = passwordChangedAt;
        }
        else {
            const fromDb = await this.findById(userId);
            if (fromDb) {
                const state = stateStore_js_1.stateStore.getState();
                if (!state.users)
                    state.users = [];
                state.users.push({ ...fromDb, passwordHash, passwordChangedAt });
            }
        }
        stateStore_js_1.stateStore.saveState();
    }
    /** Every account (MongoDB + state file, de-duplicated by userId), without password hashes. */
    async listAll() {
        const byId = new Map();
        if (mongoReady()) {
            try {
                const docs = await User_js_1.User.find().lean();
                docs.forEach((d) => {
                    const u = fromMongo(d);
                    byId.set(u.userId, u);
                });
            }
            catch {
                // ignore
            }
        }
        (stateStore_js_1.stateStore.getState().users || []).forEach((u) => {
            if (!byId.has(u.userId))
                byId.set(u.userId, u);
        });
        return [...byId.values()].map((u) => ({
            ...this.toPublic(u),
            status: u.disabled ? 'Disabled' : 'Active',
            createdAt: u.createdAt,
            isDemo: u.isDemo
        }));
    }
    async setDisabled(userId, disabled) {
        let found = false;
        if (mongoReady()) {
            try {
                const r = await User_js_1.User.updateOne({ userId }, { $set: { disabled } });
                found = r.matchedCount > 0;
            }
            catch {
                // ignore
            }
        }
        const local = stateStore_js_1.stateStore.getState().users?.find((u) => String(u.userId) === String(userId));
        if (local) {
            local.disabled = disabled || undefined;
            found = true;
            stateStore_js_1.stateStore.saveState();
        }
        return found;
    }
    /**
     * Creates the demo accounts shown on the login page as real bcrypt-hashed users.
     * Existing accounts are never overwritten.
     */
    async seedDemoAccounts() {
        if (!index_js_1.config.demoAccounts)
            return 0;
        const demo = [
            { userId: '90', email: '123@gmail.com', password: 'secret99', role: 'patient', name: 'Tanmay Shishodia' },
            { userId: '1593418229676', email: 'house@princeton.edu', password: 'secret99', role: 'doctor', name: 'Dr. Gregory House' },
            { userId: 'hosp-01', email: 'admin@generalhospital.com', password: 'hospital123', role: 'hospital-admin', name: 'Metro General Hospital Admin' },
            { userId: 'lab-01', email: 'lab@pathology.com', password: 'lab123', role: 'lab', name: 'Apex Diagnostic Pathology Lab' },
            { userId: 'ins-01', email: 'claims@healthshield.com', password: 'insurance123', role: 'insurance', name: 'HealthShield Insurance Adjudicator' },
            { userId: 'admin-01', email: 'admin@medledger.io', password: 'admin123', role: 'admin', name: 'MedLedger System Administrator' }
        ];
        const state = stateStore_js_1.stateStore.getState();
        if (!state.users)
            state.users = [];
        let created = 0;
        for (const d of demo) {
            const exists = state.users.some((u) => normaliseEmail(u.email) === d.email);
            if (exists)
                continue;
            state.users.push({
                userId: d.userId,
                email: d.email,
                role: d.role,
                name: d.name,
                passwordHash: await this.hashPassword(d.password),
                walletAddress: state.patients.find((p) => p.patientId === d.userId)?.ethereumAddress ||
                    state.doctors.find((doc) => doc.doctorId === d.userId)?.ethereumAddress ||
                    blockchainService_js_1.blockchainService.deriveAddress(d.userId),
                passwordChangedAt: 0,
                createdAt: new Date().toISOString(),
                isDemo: true
            });
            created++;
        }
        if (created > 0)
            stateStore_js_1.stateStore.saveState();
        return created;
    }
}
exports.userStore = new UserStore();
