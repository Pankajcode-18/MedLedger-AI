import crypto from 'crypto';
import { Request, Response } from 'express';
import { stateStore } from '../models/stateStore.js';
import { config } from '../config/index.js';
import { auditService } from '../services/auditService.js';
import { userStore, DEMO_ACCOUNTS } from '../services/userStore.js';
import { tokenService } from '../services/tokenService.js';
import { loginGuard } from '../services/loginGuard.js';
import {
  registerUserSchema,
  adminCreateUserSchema,
  loginUserSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from '../validators/index.js';
import { AuthenticatedRequest, UserRole } from '../types/index.js';

const firstIssue = (err: { issues: Array<{ message: string }> }, fallback: string): string =>
  err.issues[0]?.message || fallback;

const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

export class AuthController {
  /** Shared by public sign-up and admin-created accounts. */
  private async createAccount(
    res: Response,
    data: { email: string; password: string; role: UserRole; name: string; phone?: string },
    actor?: { userId: string; role: UserRole }
  ): Promise<void> {
    const existing = await userStore.findByEmail(data.email);
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'An account with this email address already exists. Please sign in.'
      });
      return;
    }

    const user = await userStore.create(data);
    const publicUser = userStore.toPublic(user);

    // Keep the patient / doctor directories in sync
    if (user.role === 'patient') {
      stateStore.addPatient({
        patientId: user.userId,
        name: user.name,
        email: user.email,
        phNo: user.phone || '',
        ethereumAddress: publicUser.walletAddress,
        type: 'patient'
      });
    } else if (user.role === 'doctor') {
      stateStore.addDoctor({
        doctorId: user.userId,
        name: user.name,
        email: user.email,
        phNo: user.phone || '',
        ethereumAddress: publicUser.walletAddress,
        type: 'doctor'
      });
    }

    await auditService.logEvent({
      patientId: user.userId,
      actorId: actor?.userId || user.userId,
      actorRole: actor?.role || (user.role as UserRole),
      action: 'USER_REGISTERED',
      details: { email: user.email, role: user.role, createdBy: actor ? 'admin' : 'self' }
    });

    // Admin-created accounts: do not log the admin in as the new user
    if (actor) {
      res.status(201).json({ success: true, message: 'Account created successfully.', data: { user: publicUser } });
      return;
    }

    const { token, expiresAt } = tokenService.sign(publicUser, { userAgent: res.req.get('user-agent'), ip: res.req.ip });
    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: { token, expiresAt, user: publicUser }
    });
  }

  /** POST /api/auth/register — public sign-up (patients and doctors only). */
  public async register(req: Request, res: Response): Promise<void> {
    try {
      const parsed = registerUserSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: firstIssue(parsed.error, 'Invalid registration details.') });
        return;
      }
      await this.createAccount(res, parsed.data);
    } catch (err: unknown) {
      console.error('[Auth] register failed:', err);
      res.status(500).json({ success: false, error: 'Failed to create account. Please try again.' });
    }
  }

  /** POST /api/admin/users — administrators create hospital, lab, insurance or admin accounts. */
  public async adminCreateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const parsed = adminCreateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: firstIssue(parsed.error, 'Invalid account details.') });
        return;
      }
      await this.createAccount(res, parsed.data, {
        userId: String(req.user?.userId),
        role: (req.user?.role || 'admin') as UserRole
      });
    } catch (err: unknown) {
      console.error('[Auth] adminCreateUser failed:', err);
      res.status(500).json({ success: false, error: 'Failed to create account.' });
    }
  }

  /** GET /api/admin/users */
  public async adminListUsers(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const users = await userStore.listAll();
    res.status(200).json({ success: true, count: users.length, data: users });
  }

  /** PATCH /api/admin/users/:userId/status  { disabled: boolean } */
  public async adminSetUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = String(req.params.userId);
    const disabled = Boolean(req.body?.disabled);
    if (disabled && userId === String(req.user?.userId)) {
      res.status(400).json({ success: false, error: 'You cannot disable your own account.' });
      return;
    }
    const ok = await userStore.setDisabled(userId, disabled);
    if (!ok) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    await auditService.logEvent({
      patientId: userId,
      actorId: String(req.user?.userId),
      actorRole: (req.user?.role || 'admin') as UserRole,
      action: disabled ? 'ACCOUNT_DISABLED' : 'ACCOUNT_ENABLED'
    });
    res.status(200).json({ success: true, message: disabled ? 'Account disabled.' : 'Account enabled.' });
  }

  /** POST /api/auth/login */
  /** POST /api/auth/demo { role } — sign in to the sample account for a role (demo mode only). */
  public async demoLogin(req: Request, res: Response): Promise<void> {
    if (!config.demoAccounts) {
      res.status(404).json({ success: false, error: 'Demo accounts are switched off on this server.' });
      return;
    }
    const role = String((req.body || {}).role || '');
    const demo = DEMO_ACCOUNTS.find((d) => d.role === role || (role === 'hospital' && d.role === 'hospital-admin'));
    if (!demo) {
      res.status(400).json({ success: false, error: 'Choose one of: patient, doctor, hospital, lab, insurance, admin.' });
      return;
    }
    const user = await userStore.findById(demo.userId);
    if (!user || !user.isDemo || user.disabled) {
      res.status(404).json({ success: false, error: 'This demo account is not available.' });
      return;
    }
    const publicUser = userStore.toPublic(user);
    const { token, expiresAt } = tokenService.sign(publicUser, { userAgent: req.get('user-agent'), ip: req.ip });
    await auditService.logEvent({
      patientId: user.userId,
      actorId: user.userId,
      actorRole: user.role as UserRole,
      action: 'USER_LOGGED_IN',
      details: { email: user.email, ip: req.ip, demo: true }
    });
    res.status(200).json({ success: true, message: 'Signed in to the demo account.', data: { token, expiresAt, user: publicUser } });
  }

  public async login(req: Request, res: Response): Promise<void> {
    try {
      const parsed = loginUserSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: firstIssue(parsed.error, 'Invalid sign-in details.') });
        return;
      }
      const { email, password } = parsed.data;

      const lockedMs = loginGuard.lockRemaining(email);
      if (lockedMs > 0) {
        const minutes = Math.ceil(lockedMs / 60_000);
        res.status(423).json({
          success: false,
          error: `Too many failed sign-in attempts. This account is locked for ${minutes} more minute${minutes === 1 ? '' : 's'}.`,
          lockedForSeconds: Math.ceil(lockedMs / 1000)
        });
        return;
      }

      const user = await userStore.findByEmail(email);
      const valid = await userStore.verifyPassword(user, password);

      if (!user || !valid) {
        const remaining = loginGuard.recordFailure(email);
        if (user) {
          await auditService.logEvent({
            patientId: user.userId,
            actorId: user.userId,
            actorRole: user.role as UserRole,
            action: remaining === 0 ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
            details: { email: user.email, ip: req.ip }
          });
        }
        res.status(remaining === 0 ? 423 : 401).json({
          success: false,
          error:
            remaining === 0
              ? `Too many failed sign-in attempts. This account is locked for ${config.lockoutMinutes} minutes.`
              : 'Invalid email or password. Please check your credentials.'
        });
        return;
      }

      if (user.disabled) {
        res.status(403).json({ success: false, error: 'This account has been disabled. Please contact your administrator.' });
        return;
      }

      loginGuard.recordSuccess(email);
      const publicUser = userStore.toPublic(user);
      const { token, expiresAt } = tokenService.sign(publicUser, { userAgent: req.get('user-agent'), ip: req.ip });

      await auditService.logEvent({
        patientId: user.userId,
        actorId: user.userId,
        actorRole: user.role as UserRole,
        action: 'USER_LOGGED_IN',
        details: { email: user.email, ip: req.ip }
      });

      res.status(200).json({
        success: true,
        message: 'Signed in successfully.',
        data: { token, expiresAt, user: publicUser }
      });
    } catch (err: unknown) {
      console.error('[Auth] login failed:', err);
      res.status(500).json({ success: false, error: 'Failed to sign in. Please try again.' });
    }
  }

  /** POST /api/auth/logout — revokes the current token. */
  public async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (req.user?.jti && req.user.exp) {
      tokenService.revoke(req.user.jti, req.user.exp);
    }
    if (req.user) {
      await auditService.logEvent({
        patientId: String(req.user.userId),
        actorId: String(req.user.userId),
        actorRole: req.user.role,
        action: 'USER_LOGGED_OUT'
      });
    }
    res.status(200).json({ success: true, message: 'Signed out.' });
  }

  /** GET /api/auth/sessions — devices currently signed in to this account. */
  public async listSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const sessions = tokenService.listSessions(String(req.user?.userId)).map((sess) => ({
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
  public async logoutOthers(req: AuthenticatedRequest, res: Response): Promise<void> {
    const ended = tokenService.revokeAllExcept(String(req.user?.userId), req.user?.jti);
    await auditService.logEvent({
      patientId: String(req.user?.userId),
      actorId: String(req.user?.userId),
      actorRole: (req.user?.role || 'patient') as UserRole,
      action: 'OTHER_SESSIONS_SIGNED_OUT',
      details: { ended }
    });
    res.status(200).json({ success: true, message: `Signed out of ${ended} other device${ended === 1 ? '' : 's'}.`, ended });
  }

  /** GET /api/auth/profile — always read from the account store, not just the token. */
  public async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user ? await userStore.findById(String(req.user.userId)) : null;
    if (!user) {
      res.status(401).json({ success: false, error: 'Please sign in.' });
      return;
    }
    res.status(200).json({ success: true, data: userStore.toPublic(user) });
  }

  /** POST /api/auth/change-password — requires the current password; signs out other sessions. */
  public async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: firstIssue(parsed.error, 'Invalid password details.') });
        return;
      }
      const user = await userStore.findById(String(req.user?.userId));
      if (!user || !(await userStore.verifyPassword(user, parsed.data.currentPassword))) {
        res.status(400).json({ success: false, error: 'Your current password is incorrect.' });
        return;
      }

      await userStore.updatePassword(user.userId, parsed.data.newPassword);
      await auditService.logEvent({
        patientId: user.userId,
        actorId: user.userId,
        actorRole: user.role as UserRole,
        action: 'PASSWORD_CHANGED'
      });

      // Old tokens are now invalid (issued before passwordChangedAt) — hand back a fresh one.
      const { token, expiresAt, jti } = tokenService.sign(userStore.toPublic(user), { userAgent: req.get('user-agent'), ip: req.ip });
      tokenService.revokeAllExcept(user.userId, jti);
      res.status(200).json({
        success: true,
        message: 'Password updated. Other devices have been signed out.',
        data: { token, expiresAt, user: userStore.toPublic(user) }
      });
    } catch (err: unknown) {
      console.error('[Auth] changePassword failed:', err);
      res.status(500).json({ success: false, error: 'Failed to update password.' });
    }
  }

  /** POST /api/auth/forgot-password — always answers the same way, so emails cannot be probed. */
  public async forgotPassword(req: Request, res: Response): Promise<void> {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: firstIssue(parsed.error, 'Please enter a valid email address.') });
      return;
    }

    const genericMessage = 'If an account exists for this email, a password reset link has been sent.';
    const user = await userStore.findByEmail(parsed.data.email);
    if (!user) {
      res.status(200).json({ success: true, message: genericMessage });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const state = stateStore.getState();
    const now = Date.now();
    state.passwordResets = (state.passwordResets || []).filter(
      (r) => r.expiresAt > now && r.userId !== user.userId
    );
    state.passwordResets.push({
      userId: user.userId,
      tokenHash: sha256(token),
      expiresAt: now + config.passwordResetMinutes * 60_000
    });
    stateStore.saveState();

    await auditService.logEvent({
      patientId: user.userId,
      actorId: user.userId,
      actorRole: user.role as UserRole,
      action: 'PASSWORD_RESET_REQUESTED'
    });

    const link = `${config.clientUrl}/reset-password?token=${token}`;
    if (config.nodeEnv !== 'test') {
      // No email service is configured — the link is printed here instead.
      console.log(`[PasswordReset] Reset link for ${user.email} (valid ${config.passwordResetMinutes} min): ${link}`);
    }

    res.status(200).json({
      success: true,
      message: genericMessage,
      ...(config.exposeResetToken ? { devResetToken: token, devResetLink: link } : {})
    });
  }

  /** POST /api/auth/reset-password */
  public async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: firstIssue(parsed.error, 'Invalid reset request.') });
        return;
      }

      const state = stateStore.getState();
      const now = Date.now();
      const tokenHash = sha256(parsed.data.token);
      const entry = (state.passwordResets || []).find((r) => r.tokenHash === tokenHash && r.expiresAt > now);
      if (!entry) {
        res.status(400).json({ success: false, error: 'This reset link is invalid or has expired. Please request a new one.' });
        return;
      }

      const user = await userStore.findById(entry.userId);
      if (!user) {
        res.status(400).json({ success: false, error: 'This reset link is invalid or has expired. Please request a new one.' });
        return;
      }

      await userStore.updatePassword(user.userId, parsed.data.newPassword);
      tokenService.revokeAllExcept(user.userId);
      state.passwordResets = (state.passwordResets || []).filter((r) => r.userId !== user.userId);
      stateStore.saveState();
      loginGuard.recordSuccess(user.email);

      await auditService.logEvent({
        patientId: user.userId,
        actorId: user.userId,
        actorRole: user.role as UserRole,
        action: 'PASSWORD_RESET_COMPLETED'
      });

      res.status(200).json({ success: true, message: 'Your password has been reset. Please sign in with the new password.' });
    } catch (err: unknown) {
      console.error('[Auth] resetPassword failed:', err);
      res.status(500).json({ success: false, error: 'Failed to reset password.' });
    }
  }
}

export const authController = new AuthController();
