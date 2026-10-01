import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Building2, Eye, EyeOff, FlaskConical, Lock, Settings, Shield, Stethoscope, Users, Wallet } from 'lucide-react';
import { dashboardPathForRole } from '../routes/ProtectedRoute.js';
import { useAuthStore } from '../store/authStore.js';
import { authApi } from '../api/authApi.js';
import { walletApi } from '../api/walletApi.js';
import { systemApi } from '../api/systemApi.js';
import { connectWallet, getProvider, signMessage, walletErrorMessage } from '../lib/wallet.js';
import { Card } from '../components/common/Card.js';
import { User } from '../types/index.js';
import { Button } from '../components/common/Button.js';

const DEMO_ROLES: Array<{ role: string; label: string; what: string; icon: React.ReactNode }> = [
  { role: 'patient', label: 'Patient', what: 'See reports, readings and who can open them', icon: <Users className="w-4 h-4" /> },
  { role: 'doctor', label: 'Doctor', what: 'Ask for access, read reports, prescribe', icon: <Stethoscope className="w-4 h-4" /> },
  { role: 'hospital', label: 'Hospital', what: 'Admissions, staff and pharmacy', icon: <Building2 className="w-4 h-4" /> },
  { role: 'lab', label: 'Laboratory', what: 'Samples and report uploads', icon: <FlaskConical className="w-4 h-4" /> },
  { role: 'insurance', label: 'Insurance', what: 'Claims, policies and report checks', icon: <Shield className="w-4 h-4" /> },
  { role: 'admin', label: 'Administrator', what: 'Accounts, organisations and security', icon: <Settings className="w-4 h-4" /> }
];

const serverError = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

export const LoginGatewayPage: React.FC = () => {
  const { setAuth } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('expired') ? 'Your session has ended. Please sign in again.' : null
  );
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    systemApi.demoMode().then(setDemoMode);
  }, []);

  const finish = (res: { token: string; user: User }) => {
    setAuth(res.user, res.token);
    const home = dashboardPathForRole(res.user.role);
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && from.split('/')[1] === home.split('/')[1] ? from : home, { replace: true });
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy('password');
    try {
      finish(await authApi.login({ email: email.trim(), password }));
    } catch (err) {
      setError(serverError(err, 'Email or password is not correct.'));
    } finally {
      setBusy(null);
    }
  };

  const tryDemo = async (role: string) => {
    setError(null);
    setBusy(role);
    try {
      finish(await authApi.demoLogin(role));
    } catch (err) {
      setError(serverError(err, 'The demo account could not be opened.'));
    } finally {
      setBusy(null);
    }
  };

  const [walletStep, setWalletStep] = useState<string | null>(null);
  const signInWithWallet = async () => {
    setError(null);
    if (!getProvider()) {
      setError('MetaMask was not found in this browser. Install MetaMask (metamask.io) or sign in with your email.');
      return;
    }
    try {
      setWalletStep('Waiting for MetaMask…');
      const address = await connectWallet();
      const { message } = await walletApi.loginChallenge(address);
      setWalletStep('Confirm in MetaMask…');
      const signature = await signMessage(address, message);
      setWalletStep('Signing in…');
      finish(await walletApi.login(message, signature));
    } catch (err) {
      setError(serverError(err, walletErrorMessage(err)));
    } finally {
      setWalletStep(null);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 max-w-5xl mx-auto font-sans">
      <div className="text-center max-w-xl mx-auto mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0B1220] tracking-tight">Sign in to MedLedger</h1>
        <p className="text-sm text-[#64748B] mt-2">One sign-in for patients, doctors, hospitals, labs and insurers. You go straight to your own workspace.</p>
      </div>

      <div className={`grid gap-6 ${demoMode ? 'lg:grid-cols-2' : 'max-w-md mx-auto'}`}>
        <Card className="p-6 sm:p-7">
          <form onSubmit={signIn} className="space-y-4" noValidate>
            {error && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div>
              <label htmlFor="login-email" className="block text-xs font-bold text-slate-700 mb-1">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="login-password" className="block text-xs font-bold text-slate-700">
                  Password
                </label>
                <Link to="/forgot-password" className="ml-tap text-xs font-semibold text-blue-600 hover:text-blue-700">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-sm p-3 pr-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" variant="primary" className="w-full" disabled={Boolean(busy) || !email || !password}>
              <Lock className="w-4 h-4 mr-1.5" />
              {busy === 'password' ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[11px] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={signInWithWallet} disabled={Boolean(busy) || Boolean(walletStep)}>
            <Wallet className="w-4 h-4 mr-1.5" />
            {walletStep || 'Sign in with MetaMask'}
          </Button>
          <p className="mt-2 text-[11px] text-slate-500 text-center">Works once you have linked your wallet in Settings.</p>

          <p className="mt-6 text-xs text-slate-600 text-center">
            New here? <Link to="/register/patient" className="ml-tap font-bold text-blue-600">Create a patient account</Link> ·{' '}
            <Link to="/register/doctor" className="ml-tap font-bold text-blue-600">Register as a doctor</Link>
          </p>
          <p className="mt-1 text-[11px] text-slate-500 text-center">Hospitals, labs and insurers are added by an administrator.</p>
        </Card>

        {demoMode && (
          <Card className="p-6 sm:p-7">
            <h2 className="text-base font-extrabold text-slate-900">Try a demo</h2>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Open a sample account to look around. Everything in it is made up, and you can change it freely.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEMO_ROLES.map((d) => (
                <button
                  key={d.role}
                  type="button"
                  onClick={() => tryDemo(d.role)}
                  disabled={Boolean(busy)}
                  className="text-left p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all disabled:opacity-60"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">{d.icon}</span>
                    {busy === d.role ? 'Opening…' : d.label}
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-1">{d.what}</span>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LoginGatewayPage;
