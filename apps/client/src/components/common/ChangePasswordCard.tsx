import React, { useState } from 'react';
import { Card } from './Card.js';
import { Button } from './Button.js';
import { PasswordStrengthMeter } from './PasswordStrengthMeter.js';
import { authApi } from '../../api/authApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { validatePassword, apiErrorMessage } from '../../lib/password.js';
import { Lock, AlertTriangle, CheckCircle } from 'lucide-react';

/** Real password change for any signed-in role (calls POST /api/auth/change-password). */
export const ChangePasswordCard: React.FC = () => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!current) return setError('Please enter your current password.');
    const rule = validatePassword(next);
    if (rule) return setError(rule);
    if (next !== confirm) return setError('New password and confirmation do not match.');
    if (next === current) return setError('The new password must be different from the current one.');

    setLoading(true);
    try {
      const res = await authApi.changePassword(current, next);
      setAuth(res.user, res.token); // old token was invalidated by the server
      setSuccess(res.message || 'Password updated.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update the password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full text-xs p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none';

  return (
    <Card className="p-6">
      <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
        <Lock className="w-4 h-4 text-sky-600" />
        <span>Change Password</span>
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Changing your password signs you out on every other device.
      </p>

      <form onSubmit={submit} className="space-y-3 max-w-md">
        {error && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}
        {success && (
          <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{success}</span>
          </div>
        )}
        <label className="block text-xs font-bold text-slate-700">
          Current password
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          New password
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <PasswordStrengthMeter password={next} />
        <label className="block text-xs font-bold text-slate-700">
          Confirm new password
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <Button type="submit" size="sm" isLoading={loading} className="text-xs font-bold">
          Update Password
        </Button>
      </form>
    </Card>
  );
};
