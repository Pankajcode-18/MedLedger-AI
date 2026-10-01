"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginGuard = void 0;
const index_js_1 = require("../config/index.js");
/**
 * Per-account brute-force protection.
 * After `maxFailedLogins` wrong passwords the account is locked for `lockoutMinutes`.
 * (IP-based throttling is handled separately by express-rate-limit on the auth routes.)
 */
class LoginGuard {
    attempts = new Map();
    key(email) {
        return email.toLowerCase().trim();
    }
    /** Milliseconds remaining on a lock, or 0 when the account may try again. */
    lockRemaining(email) {
        const state = this.attempts.get(this.key(email));
        if (!state)
            return 0;
        const remaining = state.lockedUntil - Date.now();
        if (remaining <= 0 && state.lockedUntil > 0) {
            this.attempts.delete(this.key(email));
            return 0;
        }
        return Math.max(0, remaining);
    }
    /** Records a failed attempt. Returns how many attempts remain before a lock (0 = now locked). */
    recordFailure(email) {
        const k = this.key(email);
        const state = this.attempts.get(k) || { failures: 0, lockedUntil: 0 };
        state.failures += 1;
        if (state.failures >= index_js_1.config.maxFailedLogins) {
            state.lockedUntil = Date.now() + index_js_1.config.lockoutMinutes * 60_000;
        }
        this.attempts.set(k, state);
        return Math.max(0, index_js_1.config.maxFailedLogins - state.failures);
    }
    recordSuccess(email) {
        this.attempts.delete(this.key(email));
    }
    /** Test helper. */
    reset() {
        this.attempts.clear();
    }
}
exports.loginGuard = new LoginGuard();
