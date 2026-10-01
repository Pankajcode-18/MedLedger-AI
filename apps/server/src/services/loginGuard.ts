import { config } from '../config/index.js';

interface AttemptState {
  failures: number;
  lockedUntil: number;
}

/**
 * Per-account brute-force protection.
 * After `maxFailedLogins` wrong passwords the account is locked for `lockoutMinutes`.
 * (IP-based throttling is handled separately by express-rate-limit on the auth routes.)
 */
class LoginGuard {
  private attempts = new Map<string, AttemptState>();

  private key(email: string): string {
    return email.toLowerCase().trim();
  }

  /** Milliseconds remaining on a lock, or 0 when the account may try again. */
  public lockRemaining(email: string): number {
    const state = this.attempts.get(this.key(email));
    if (!state) return 0;
    const remaining = state.lockedUntil - Date.now();
    if (remaining <= 0 && state.lockedUntil > 0) {
      this.attempts.delete(this.key(email));
      return 0;
    }
    return Math.max(0, remaining);
  }

  /** Records a failed attempt. Returns how many attempts remain before a lock (0 = now locked). */
  public recordFailure(email: string): number {
    const k = this.key(email);
    const state = this.attempts.get(k) || { failures: 0, lockedUntil: 0 };
    state.failures += 1;
    if (state.failures >= config.maxFailedLogins) {
      state.lockedUntil = Date.now() + config.lockoutMinutes * 60_000;
    }
    this.attempts.set(k, state);
    return Math.max(0, config.maxFailedLogins - state.failures);
  }

  public recordSuccess(email: string): void {
    this.attempts.delete(this.key(email));
  }

  /** Test helper. */
  public reset(): void {
    this.attempts.clear();
  }
}

export const loginGuard = new LoginGuard();
