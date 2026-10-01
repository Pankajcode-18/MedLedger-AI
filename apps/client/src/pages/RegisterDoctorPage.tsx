import React, { useState } from 'react';
import { settingsApi } from '../api/settingsApi.js';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/authApi.js';
import { useAuthStore } from '../store/authStore.js';
import { Card } from '../components/common/Card.js';
import { Button } from '../components/common/Button.js';
import { PasswordStrengthMeter } from '../components/common/PasswordStrengthMeter.js';
import { validatePassword } from '../lib/password.js';
import {
  Stethoscope,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export const RegisterDoctorPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [licenseId, setLicenseId] = useState('');
  const [phNo, setPhNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const passwordProblem = validatePassword(password);
    if (passwordProblem) {
      setError(passwordProblem);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await authApi.register({
        name,
        email,
        password,
        role: 'doctor',
        phone: phNo
      });

      setAuth(res.user, res.token);
      // the registration number is kept with the practice details, where the doctor can edit it later
      settingsApi.save('practice', { name, email, license: licenseId, phone: phNo }).catch(() => undefined);
      setToast('Your account is ready. Taking you to your workspace…');
      setTimeout(() => navigate('/doctor/dashboard'), 1000);
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'We could not create the account. Please check the details and try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-lg mx-auto">
      <Card className="p-6 sm:p-8 space-y-6 shadow-xl shadow-slate-200/50 border-slate-200">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 shadow-xs">
            <Stethoscope className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create a doctor account</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Ask patients to share their records with you and get AI help reading reports.
          </p>
        </div>

        {toast && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{toast}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2.5 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Doctor Full Name &amp; Degree</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. Anjali Koirala"
              className="w-full text-sm p-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Professional Hospital Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="doctor@hospital.org"
              className="w-full text-sm p-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a secure password"
                autoComplete="new-password"
                className="w-full text-sm p-3 pr-10 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrengthMeter password={password} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Medical council registration number</label>
            <input
              type="text"
              required
              value={licenseId}
              onChange={(e) => setLicenseId(e.target.value)}
              placeholder="e.g. NMC-12345"
              className="w-full text-sm p-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium font-mono"
            />
          </div>

          <div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={phNo}
                onChange={(e) => setPhNo(e.target.value)}
                placeholder="+977 98XXXXXXXX"
                className="w-full text-sm p-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full py-3.5 mt-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-sm shadow-md shadow-emerald-600/20"
            isLoading={loading}
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Create doctor account
          </Button>
        </form>

        <div className="text-center text-xs text-slate-500 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span>Already certified?</span>
          <Link to="/login" className="ml-tap text-emerald-600 font-bold hover:underline">
            Sign in &rarr;
          </Link>
        </div>
      </Card>
    </div>
  );
};
