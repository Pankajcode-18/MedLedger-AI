import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/authApi.js';
import { Card } from '../components/common/Card.js';
import { Button } from '../components/common/Button.js';
import { apiErrorMessage } from '../lib/password.js';
import { KeyRound, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      setMessage(res.message);
      setDevLink(res.devResetToken ? `/reset-password?token=${res.devResetToken}` : null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send the reset link. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] py-10 px-4 max-w-md mx-auto">
      <Card className="p-6 sm:p-8 space-y-5 shadow-xl shadow-slate-200/50">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-2">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Forgot your password?</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Enter the email you signed up with and we will send you a link to choose a new password.
          </p>
        </div>

        {error && (
          <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {message ? (
          <div className="space-y-3">
            <div role="status" className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-medium">{message} The link expires in 15 minutes.</span>
            </div>
            {devLink && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-2">
                <p>
                  <strong>Development mode:</strong> no email service is configured, so the reset link is shown here
                  (demo mode only).
                </p>
                <Link to={devLink} className="inline-block font-bold text-sky-700 underline">
                  Open reset link
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-xs font-semibold text-slate-700">
              Email address
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full text-sm p-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              />
            </label>
            <Button type="submit" isLoading={loading} className="w-full">
              Send reset link
            </Button>
          </form>
        )}

        <Link to="/login" className="min-h-[44px] flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-sky-700">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
        </Link>
      </Card>
    </div>
  );
};
