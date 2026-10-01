import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/authApi.js';
import { Card } from '../components/common/Card.js';
import { Button } from '../components/common/Button.js';
import { PasswordStrengthMeter } from '../components/common/PasswordStrengthMeter.js';
import { validatePassword, apiErrorMessage } from '../lib/password.js';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const rule = validatePassword(password);
    if (rule) return setError(rule);
    if (password !== confirm) return setError('The two passwords do not match.');

    setLoading(true);
    try {
      const res = await authApi.resetPassword(token, password);
      setDone(res.message);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(apiErrorMessage(err, 'This reset link is invalid or has expired.'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'mt-1 w-full text-sm p-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium';

  return (
    <div className="min-h-[70vh] py-10 px-4 max-w-md mx-auto">
      <Card className="p-6 sm:p-8 space-y-5 shadow-xl shadow-slate-200/50">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Choose a new password</h1>
        </div>

        {!token ? (
          <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
            This link is missing its reset token.{' '}
            <Link to="/forgot-password" className="font-bold underline">
              Request a new link
            </Link>
            .
          </div>
        ) : done ? (
          <div role="status" className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-medium">{done} Redirecting to sign in…</span>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}
            <label className="block text-xs font-semibold text-slate-700">
              New password
              <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </label>
            <PasswordStrengthMeter password={password} />
            <label className="block text-xs font-semibold text-slate-700">
              Confirm new password
              <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
            </label>
            <Button type="submit" isLoading={loading} className="w-full">
              Save new password
            </Button>
          </form>
        )}

        <Link to="/login" className="min-h-[44px] flex items-center justify-center text-xs font-semibold text-slate-600 hover:text-sky-700">
          Back to sign in
        </Link>
      </Card>
    </div>
  );
};
