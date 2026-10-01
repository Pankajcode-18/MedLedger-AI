import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config/index.js';
import { stateStore } from '../models/stateStore.js';
import { AuthenticatedUser } from '../types/index.js';
import { PublicUser, userStore } from './userStore.js';

export class TokenError extends Error {}

/**
 * Issues and validates JWT access tokens.
 *  - HS256 only (algorithm pinned on verify, so "alg: none" or RS/HS confusion is rejected)
 *  - issuer + audience claims
 *  - unique `jti` so a single token can be revoked on logout
 *  - tokens issued before a password change are rejected
 */
class TokenService {
  public sign(
    user: PublicUser,
    meta: { userAgent?: string; ip?: string } = {}
  ): { token: string; expiresAt: number; jti: string } {
    const jti = crypto.randomUUID();
    const token = jwt.sign(
      {
        id: user.userId,
        userId: user.userId,
        email: user.email,
        role: user.role,
        name: user.name,
        walletAddress: user.walletAddress
      },
      config.jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
        subject: String(user.userId),
        jwtid: jti
      }
    );
    const decoded = jwt.decode(token) as { exp: number; iat: number };

    // Record the session so the user can review and end it later
    const state = stateStore.getState();
    const nowSec = Math.floor(Date.now() / 1000);
    state.sessions = (state.sessions || []).filter((sess) => sess.exp > nowSec);
    state.sessions.push({
      jti,
      userId: String(user.userId),
      userAgent: (meta.userAgent || 'Unknown device').slice(0, 200),
      ip: meta.ip || '',
      createdAt: decoded.iat * 1000,
      exp: decoded.exp
    });
    stateStore.saveState();

    return { token, expiresAt: decoded.exp * 1000, jti };
  }

  public async verify(token: string): Promise<AuthenticatedUser> {
    let payload: AuthenticatedUser & { jti?: string; iat?: number; exp?: number };
    try {
      payload = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'],
        issuer: config.jwtIssuer,
        audience: config.jwtAudience
      }) as typeof payload;
    } catch {
      throw new TokenError('Your sign-in has expired. Please sign in again.');
    }

    if (payload.jti && this.isRevoked(payload.jti)) {
      throw new TokenError('This session has been signed out. Please sign in again.');
    }

    const user = await userStore.findById(String(payload.userId));
    if (!user) {
      throw new TokenError('This account no longer exists.');
    }
    if (user.disabled) {
      throw new TokenError('This account has been disabled. Please contact your administrator.');
    }
    if (user.passwordChangedAt && payload.iat && payload.iat * 1000 < user.passwordChangedAt) {
      throw new TokenError('Your password was changed. Please sign in again.');
    }

    // Role and name always come from the account record, never only from the token.
    return {
      ...payload,
      role: user.role as AuthenticatedUser['role'],
      name: user.name,
      email: user.email,
      // a wallet linked after sign-in applies straight away
      walletAddress: user.walletAddress || payload.walletAddress
    };
  }

  /** Active (unexpired, unrevoked) sessions for a user, newest first. */
  public listSessions(userId: string): Array<{ jti: string; userAgent: string; ip: string; createdAt: number; expiresAt: number }> {
    const nowSec = Math.floor(Date.now() / 1000);
    return (stateStore.getState().sessions || [])
      .filter((sess) => sess.userId === String(userId) && sess.exp > nowSec && !this.isRevoked(sess.jti))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((sess) => ({ jti: sess.jti, userAgent: sess.userAgent, ip: sess.ip, createdAt: sess.createdAt, expiresAt: sess.exp * 1000 }));
  }

  /** Signs out every session of a user except `keepJti`. Returns how many were ended. */
  public revokeAllExcept(userId: string, keepJti?: string): number {
    const sessions = this.listSessions(userId).filter((sess) => sess.jti !== keepJti);
    const all = stateStore.getState().sessions || [];
    sessions.forEach((sess) => {
      const rec = all.find((r) => r.jti === sess.jti);
      if (rec) this.revoke(rec.jti, rec.exp);
    });
    return sessions.length;
  }

  /** Revokes one token until its natural expiry. */
  public revoke(jti: string, expSeconds: number): void {
    const state = stateStore.getState();
    const now = Math.floor(Date.now() / 1000);
    state.revokedTokens = (state.revokedTokens || []).filter((t) => t.exp > now);
    if (!state.revokedTokens.some((t) => t.jti === jti)) {
      state.revokedTokens.push({ jti, exp: expSeconds });
    }
    stateStore.saveState();
  }

  public isRevoked(jti: string): boolean {
    return (stateStore.getState().revokedTokens || []).some((t) => t.jti === jti);
  }
}

export const tokenService = new TokenService();
