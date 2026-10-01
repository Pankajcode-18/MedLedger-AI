"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const crypto_1 = __importDefault(require("crypto"));
const stateStore_js_1 = require("../models/stateStore.js");
const index_js_1 = require("../config/index.js");
const auditService_js_1 = require("../services/auditService.js");
const userStore_js_1 = require("../services/userStore.js");
const tokenService_js_1 = require("../services/tokenService.js");
const loginGuard_js_1 = require("../services/loginGuard.js");
const index_js_2 = require("../validators/index.js");
const firstIssue = (err, fallback) => err.issues[0]?.message || fallback;
const sha256 = (value) => crypto_1.default.createHash('sha256').update(value).digest('hex');
class AuthController {
    /** Shared by public sign-up and admin-created accounts. */
    async createAccount(res, data, actor) {
        const existing = await userStore_js_1.userStore.findByEmail(data.email);
        if (existing) {
            res.status(409).json({
                success: false,
                error: 'An account with this email address already exists. Please sign in.'
            });
            return;
        }
        const user = await userStore_js_1.userStore.create(data);
        const publicUser = userStore_js_1.userStore.toPublic(user);
        // Keep the patient / doctor directories in sync
        if (user.role === 'patient') {
            stateStore_js_1.stateStore.addPatient({
                patientId: user.userId,
                name: user.name,
                email: user.email,
                phNo: user.phone || '',
                ethereumAddress: publicUser.walletAddress,
                type: 'patient'
            });
        }
        else if (user.role === 'doctor') {
            stateStore_js_1.stateStore.addDoctor({
                doctorId: user.userId,
                name: user.name,
                email: user.email,
                phNo: user.phone || '',
                ethereumAddress: publicUser.walletAddress,
                type: 'doctor'
            });
        }
        await auditService_js_1.auditService.logEvent({
            patientId: user.userId,
            actorId: actor?.userId || user.userId,
            actorRole: actor?.role || user.role,
            action: 'USER_REGISTERED',
            details: { email: user.email, role: user.role, createdBy: actor ? 'admin' : 'self' }
        });
        // Admin-created accounts: do not log the admin in as the new user
        if (actor) {
            res.status(201).json({ success: true, message: 'Account created successfully.', data: { user: publicUser } });
            return;
        }
        const { token, expiresAt } = tokenService_js_1.tokenService.sign(publicUser, { userAgent: res.req.get('user-agent'), ip: res.req.ip });
        res.status(201).json({
            success: true,
            message: 'Account created successfully.',
            data: { token, expiresAt, user: publicUser }
        });
    }
    /** POST /api/auth/register — public sign-up (patients and doctors only). */
    async register(req, res) {
        try {
            const parsed = index_js_2.registerUserSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ success: false, error: firstIssue(parsed.error, 'Invalid registration details.') });
                return;
            }
            await this.createAccount(res, parsed.data);
        }
        catch (err) {
            console.error('[Auth] register failed:', err);
            res.status(500).json({ success: false, error: 'Failed to create account. Please try again.' });
        }
    }
    /** POST /api/admin/users — administrators create hospital, lab, insurance or admin accounts. */
    async adminCreateUser(req, res) {
        try {
            const parsed = index_js_2.adminCreateUserSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ success: false, error: firstIssue(parsed.error, 'Invalid account details.') });
                return;
            }
            await this.createAccount(res, parsed.data, {
                userId: String(req.user?.userId),
                role: (req.user?.role || 'admin')
            });
        }
        catch (err) {
            console.error('[Auth] adminCreateUser failed:', err);
            res.status(500).json({ success: false, error: 'Failed to create account.' });
        }
    }
    /** GET /api/admin/users */
    async adminListUsers(_req, res) {
        const users = await userStore_js_1.userStore.listAll();
        res.status(200).json({ success: true, count: users.length, data: users });
    }
    /** PATCH /api/admin/users/:userId/status  { disabled: boolean } */
    async adminSetUserStatus(req, res) {
        const userId = String(req.params.userId);
        const disabled = Boolean(req.body?.disabled);
        if (disabled && userId === String(req.user?.userId)) {
            res.status(400).json({ success: false, error: 'You cannot disable your own account.' });
            return;
        }
        const ok = await userStore_js_1.userStore.setDisabled(userId, disabled);
        if (!ok) {
            res.status(404).json({ success: false, error: 'User not found.' });
            return;
        }
        await auditService_js_1.auditService.logEvent({
            patientId: userId,
            actorId: String(req.user?.userId),
            actorRole: (req.user?.role || 'admin'),
            action: disabled ? 'ACCOUNT_DISABLED' : 'ACCOUNT_ENABLED'
        });
        res.status(200).json({ success: true, message: disabled ? 'Account disabled.' : 'Account enabled.' });
    }
    /** POST /api/auth/login */
    async login(req, res) {
        try {
            const parsed = index_js_2.loginUserSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ success: false, error: firstIssue(parsed.error, 'Invalid sign-in details.') });
                return;
            }
            const { email, password } = parsed.data;
            const lockedMs = loginGuard_js_1.loginGuard.lockRemaining(email);
            if (lockedMs > 0) {
                const minutes = Math.ceil(lockedMs / 60_000);
                res.status(423).json({
                    success: false,
                    error: `Too many failed sign-in attempts. This account is locked for ${minutes} more minute${minutes === 1 ? '' : 's'}.`,
                    lockedForSeconds: Math.ceil(lockedMs / 1000)
                });
                return;
            }
            const user = await userStore_js_1.userStore.findByEmail(email);
            const valid = await userStore_js_1.userStore.verifyPassword(user, password);
            if (!user || !valid) {
                const remaining = loginGuard_js_1.loginGuard.recordFailure(email);
                if (user) {
                    await auditService_js_1.auditService.logEvent({
                        patientId: user.userId,
                        actorId: user.userId,
                        actorRole: user.role,
                        action: remaining === 0 ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
                        details: { email: user.email, ip: req.ip }
                    });
                }
                res.status(remaining === 0 ? 423 : 401).json({
                    success: false,
                    error: remaining === 0
                        ? `Too many failed sign-in attempts. This account is locked for ${index_js_1.config.lockoutMinutes} minutes.`
                        : 'Invalid email or password. Please check your credentials.'
                });
                return;
            }
            if (user.disabled) {
                res.status(403).json({ success: false, error: 'This account has been disabled. Please contact your administrator.' });
                return;
            }
            loginGuard_js_1.loginGuard.recordSuccess(email);
            const publicUser = userStore_js_1.userStore.toPublic(user);
            const { token, expiresAt } = tokenService_js_1.tokenService.sign(publicUser, { userAgent: req.get('user-agent'), ip: req.ip });
            await auditService_js_1.auditService.logEvent({
                patientId: user.userId,
                actorId: user.userId,
                actorRole: user.role,
                action: 'USER_LOGGED_IN',
                details: { email: user.email, ip: req.ip }
            });
            res.status(200).json({
                success: true,
                message: 'Signed in successfully.',
                data: { token, expiresAt, user: publicUser }
            });
        }
        catch (err) {
            console.error('[Auth] login failed:', err);
            res.status(500).json({ success: false, error: 'Failed to sign in. Please try again.' });
        }
    }
    /** POST /api/auth/logout — revokes the current token. */
    async logout(req, res) {
        if (req.user?.jti && req.user.exp) {
            tokenService_js_1.tokenService.revoke(req.user.jti, req.user.exp);
        }
        if (req.user) {
            await auditService_js_1.auditService.logEvent({
                patientId: String(req.user.userId),
                actorId: String(req.user.userId),
                actorRole: req.user.role,
                action: 'USER_LOGGED_OUT'
            });
        }
        res.status(200).json({ success: true, message: 'Signed out.' });
    }
    /** GET /api/auth/sessions — devices currently signed in to this account. */
    async listSessions(req, res) {
        const sessions = tokenService_js_1.tokenService.listSessions(String(req.user?.userId)).map((sess) => ({
            id: sess.jti,
            device: sess.userAgent,
            ip: sess.ip,
            signedInAt: new Date(sess.createdAt).toISOString(),
            expiresAt: new Date(sess.expiresAt).toISOString(),
            current: sess.jti === req.user?.jti
        }));
        res.status(200).json({ success: true, data: sessions });
    }
    /** POST /api/auth/logout-others — ends every session except the one making the request. */
    async logoutOthers(req, res) {
        const ended = tokenService_js_1.tokenService.revokeAllExcept(String(req.user?.userId), req.user?.jti);
        await auditService_js_1.auditService.logEvent({
            patientId: String(req.user?.userId),
            actorId: String(req.user?.userId),
            actorRole: (req.user?.role || 'patient'),
            action: 'OTHER_SESSIONS_SIGNED_OUT',
            details: { ended }
        });
        res.status(200).json({ success: true, message: `Signed out of ${ended} other device${ended === 1 ? '' : 's'}.`, ended });
    }
    /** GET /api/auth/profile — always read from the account store, not just the token. */
    async getProfile(req, res) {
        const user = req.user ? await userStore_js_1.userStore.findById(String(req.user.userId)) : null;
        if (!user) {
            res.status(401).json({ success: false, error: 'Unauthorized.' });
            return;
        }
        res.status(200).json({ success: true, data: userStore_js_1.userStore.toPublic(user) });
    }
    /** POST /api/auth/change-password — requires the current password; signs out other sessions. */
    async changePassword(req, res) {
        try {
            const parsed = index_js_2.changePasswordSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ success: false, error: firstIssue(parsed.error, 'Invalid password details.') });
                return;
            }
            const user = await userStore_js_1.userStore.findById(String(req.user?.userId));
            if (!user || !(await userStore_js_1.userStore.verifyPassword(user, parsed.data.currentPassword))) {
                res.status(400).json({ success: false, error: 'Your current password is incorrect.' });
                return;
            }
            await userStore_js_1.userStore.updatePassword(user.userId, parsed.data.newPassword);
            await auditService_js_1.auditService.logEvent({
                patientId: user.userId,
                actorId: user.userId,
                actorRole: user.role,
                action: 'PASSWORD_CHANGED'
            });
            // Old tokens are now invalid (issued before passwordChangedAt) — hand back a fresh one.
            const { token, expiresAt, jti } = tokenService_js_1.tokenService.sign(userStore_js_1.userStore.toPublic(user), { userAgent: req.get('user-agent'), ip: req.ip });
            tokenService_js_1.tokenService.revokeAllExcept(user.userId, jti);
            res.status(200).json({
                success: true,
                message: 'Password updated. Other devices have been signed out.',
                data: { token, expiresAt, user: userStore_js_1.userStore.toPublic(user) }
            });
        }
        catch (err) {
            console.error('[Auth] changePassword failed:', err);
            res.status(500).json({ success: false, error: 'Failed to update password.' });
        }
    }
    /** POST /api/auth/forgot-password — always answers the same way, so emails cannot be probed. */
    async forgotPassword(req, res) {
        const parsed = index_js_2.forgotPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: firstIssue(parsed.error, 'Please enter a valid email address.') });
            return;
        }
        const genericMessage = 'If an account exists for this email, a password reset link has been sent.';
        const user = await userStore_js_1.userStore.findByEmail(parsed.data.email);
        if (!user) {
            res.status(200).json({ success: true, message: genericMessage });
            return;
        }
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const state = stateStore_js_1.stateStore.getState();
        const now = Date.now();
        state.passwordResets = (state.passwordResets || []).filter((r) => r.expiresAt > now && r.userId !== user.userId);
        state.passwordResets.push({
            userId: user.userId,
            tokenHash: sha256(token),
            expiresAt: now + index_js_1.config.passwordResetMinutes * 60_000
        });
        stateStore_js_1.stateStore.saveState();
        await auditService_js_1.auditService.logEvent({
            patientId: user.userId,
            actorId: user.userId,
            actorRole: user.role,
            action: 'PASSWORD_RESET_REQUESTED'
        });
        const link = `${index_js_1.config.clientUrl}/reset-password?token=${token}`;
        if (index_js_1.config.nodeEnv !== 'test') {
            // No email service is configured — the link is printed here instead.
            console.log(`[PasswordReset] Reset link for ${user.email} (valid ${index_js_1.config.passwordResetMinutes} min): ${link}`);
        }
        res.status(200).json({
            success: true,
            message: genericMessage,
            ...(index_js_1.config.exposeResetToken ? { devResetToken: token, devResetLink: link } : {})
        });
    }
    /** POST /api/auth/reset-password */
    async resetPassword(req, res) {
        try {
            const parsed = index_js_2.resetPasswordSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ success: false, error: firstIssue(parsed.error, 'Invalid reset request.') });
                return;
            }
            const state = stateStore_js_1.stateStore.getState();
            const now = Date.now();
            const tokenHash = sha256(parsed.data.token);
            const entry = (state.passwordResets || []).find((r) => r.tokenHash === tokenHash && r.expiresAt > now);
            if (!entry) {
                res.status(400).json({ success: false, error: 'This reset link is invalid or has expired. Please request a new one.' });
                return;
            }
            const user = await userStore_js_1.userStore.findById(entry.userId);
            if (!user) {
                res.status(400).json({ success: false, error: 'This reset link is invalid or has expired. Please request a new one.' });
                return;
            }
            await userStore_js_1.userStore.updatePassword(user.userId, parsed.data.newPassword);
            tokenService_js_1.tokenService.revokeAllExcept(user.userId);
            state.passwordResets = (state.passwordResets || []).filter((r) => r.userId !== user.userId);
            stateStore_js_1.stateStore.saveState();
            loginGuard_js_1.loginGuard.recordSuccess(user.email);
            await auditService_js_1.auditService.logEvent({
                patientId: user.userId,
                actorId: user.userId,
                actorRole: user.role,
                action: 'PASSWORD_RESET_COMPLETED'
            });
            res.status(200).json({ success: true, message: 'Your password has been reset. Please sign in with the new password.' });
        }
        catch (err) {
            console.error('[Auth] resetPassword failed:', err);
            res.status(500).json({ success: false, error: 'Failed to reset password.' });
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
