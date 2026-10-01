"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenService = exports.TokenError = void 0;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_js_1 = require("../config/index.js");
const stateStore_js_1 = require("../models/stateStore.js");
const userStore_js_1 = require("./userStore.js");
class TokenError extends Error {
}
exports.TokenError = TokenError;
/**
 * Issues and validates JWT access tokens.
 *  - HS256 only (algorithm pinned on verify, so "alg: none" or RS/HS confusion is rejected)
 *  - issuer + audience claims
 *  - unique `jti` so a single token can be revoked on logout
 *  - tokens issued before a password change are rejected
 */
class TokenService {
    sign(user, meta = {}) {
        const jti = crypto_1.default.randomUUID();
        const token = jsonwebtoken_1.default.sign({
            id: user.userId,
            userId: user.userId,
            email: user.email,
            role: user.role,
            name: user.name,
            walletAddress: user.walletAddress
        }, index_js_1.config.jwtSecret, {
            algorithm: 'HS256',
            expiresIn: index_js_1.config.jwtExpiresIn,
            issuer: index_js_1.config.jwtIssuer,
            audience: index_js_1.config.jwtAudience,
            subject: String(user.userId),
            jwtid: jti
        });
        const decoded = jsonwebtoken_1.default.decode(token);
        // Record the session so the user can review and end it later
        const state = stateStore_js_1.stateStore.getState();
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
        stateStore_js_1.stateStore.saveState();
        return { token, expiresAt: decoded.exp * 1000, jti };
    }
    async verify(token) {
        let payload;
        try {
            payload = jsonwebtoken_1.default.verify(token, index_js_1.config.jwtSecret, {
                algorithms: ['HS256'],
                issuer: index_js_1.config.jwtIssuer,
                audience: index_js_1.config.jwtAudience
            });
        }
        catch {
            throw new TokenError('Your session has expired or the token is invalid. Please sign in again.');
        }
        if (payload.jti && this.isRevoked(payload.jti)) {
            throw new TokenError('This session has been signed out. Please sign in again.');
        }
        const user = await userStore_js_1.userStore.findById(String(payload.userId));
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
            role: user.role,
            name: user.name,
            email: user.email,
            // a wallet linked after sign-in applies straight away
            walletAddress: user.walletAddress || payload.walletAddress
        };
    }
    /** Active (unexpired, unrevoked) sessions for a user, newest first. */
    listSessions(userId) {
        const nowSec = Math.floor(Date.now() / 1000);
        return (stateStore_js_1.stateStore.getState().sessions || [])
            .filter((sess) => sess.userId === String(userId) && sess.exp > nowSec && !this.isRevoked(sess.jti))
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((sess) => ({ jti: sess.jti, userAgent: sess.userAgent, ip: sess.ip, createdAt: sess.createdAt, expiresAt: sess.exp * 1000 }));
    }
    /** Signs out every session of a user except `keepJti`. Returns how many were ended. */
    revokeAllExcept(userId, keepJti) {
        const sessions = this.listSessions(userId).filter((sess) => sess.jti !== keepJti);
        const all = stateStore_js_1.stateStore.getState().sessions || [];
        sessions.forEach((sess) => {
            const rec = all.find((r) => r.jti === sess.jti);
            if (rec)
                this.revoke(rec.jti, rec.exp);
        });
        return sessions.length;
    }
    /** Revokes one token until its natural expiry. */
    revoke(jti, expSeconds) {
        const state = stateStore_js_1.stateStore.getState();
        const now = Math.floor(Date.now() / 1000);
        state.revokedTokens = (state.revokedTokens || []).filter((t) => t.exp > now);
        if (!state.revokedTokens.some((t) => t.jti === jti)) {
            state.revokedTokens.push({ jti, exp: expSeconds });
        }
        stateStore_js_1.stateStore.saveState();
    }
    isRevoked(jti) {
        return (stateStore_js_1.stateStore.getState().revokedTokens || []).some((t) => t.jti === jti);
    }
}
exports.tokenService = new TokenService();
