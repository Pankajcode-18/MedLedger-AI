/** Mirrors the server-side password policy (apps/server/src/validators). */
export const PASSWORD_RULES_TEXT = 'At least 8 characters, including a letter and a number.';

export const validatePassword = (password: string): string | null => {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (password.length > 72) return 'Password must be at most 72 characters long.';
  if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
};

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string; barClass: string; textClass: string };

export const passwordStrength = (password: string): PasswordStrength => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Za-z]/.test(password) && /[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password) || (/[a-z]/.test(password) && /[A-Z]/.test(password))) score++;
  const s = Math.min(score, 4) as PasswordStrength['score'];
  const table: Record<number, Omit<PasswordStrength, 'score'>> = {
    0: { label: 'Too short', barClass: 'w-1/12 bg-rose-500', textClass: 'text-rose-700' },
    1: { label: 'Weak', barClass: 'w-1/4 bg-rose-500', textClass: 'text-rose-700' },
    2: { label: 'Fair', barClass: 'w-1/2 bg-amber-500', textClass: 'text-amber-700' },
    3: { label: 'Good', barClass: 'w-3/4 bg-sky-500', textClass: 'text-sky-700' },
    4: { label: 'Strong', barClass: 'w-full bg-emerald-500', textClass: 'text-emerald-700' }
  };
  return { score: s, ...table[s] };
};

/** Pulls the server's error message out of an axios error. */
export const apiErrorMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
