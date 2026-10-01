import React, { useState } from 'react';
import { LanguagePicker } from '../common/LanguagePicker.js';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';
import { useUIStore } from '../../store/uiStore.js';
import { Button } from '../common/Button.js';
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Layers,
  ChevronRight,
  ArrowRight
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();

  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardRoute = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'patient':
        return '/patient/dashboard';
      case 'doctor':
        return '/doctor/dashboard';
      case 'hospital':
      case 'hospital-admin':
        return '/hospital/dashboard';
      case 'lab':
        return '/lab/dashboard';
      case 'insurance':
        return '/insurance/dashboard';
      case 'admin':
      case 'system-admin':
        return '/admin/dashboard';
      default:
        return '/patient/dashboard';
    }
  };

  const scrollToSection = (id: string) => {
    if (location.pathname !== '/') {
      navigate('/#' + id);
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          
          {/* Brand Logo & Name */}
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/90 shadow-2xs p-1 flex items-center justify-center group-hover:border-blue-500 transition-colors">
              <img
                src="/logo.png"
                alt="MedLedger Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">
                MedLedger
              </span>
              <span className="bg-blue-50 text-blue-700 border border-blue-200/80 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                AI
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-1">
            <Link
              to="/"
              className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 rounded-lg transition-colors"
            >
              Home
            </Link>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 rounded-lg transition-colors"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('workspaces')}
              className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 rounded-lg transition-colors"
            >
              Workspaces
            </button>
            <button
              onClick={() => scrollToSection('security')}
              className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 rounded-lg transition-colors"
            >
              Security
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 rounded-lg transition-colors"
            >
              FAQ
            </button>
          </div>

          {/* Desktop Actions */}
          <div className="hidden sm:flex items-center gap-3">
            <LanguagePicker />

            {isAuthenticated ? (
              <div className="flex items-center gap-2 pl-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(getDashboardRoute())}
                  icon={<LayoutDashboard className="w-4 h-4" />}
                  className="rounded-lg font-medium"
                >
                  My workspace
                </Button>
                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2">
                <button
                  onClick={() => navigate('/login')}
                  className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg transition-all"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs hover:shadow-sm transition-all"
                >
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center lg:hidden gap-2">
            <LanguagePicker compact className="sm:hidden" />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-6 space-y-3 animate-fade-in shadow-lg">

          <div className="space-y-1">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between py-2 px-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600"
            >
              <span>Home</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                scrollToSection('how-it-works');
              }}
              className="w-full flex items-center justify-between py-2 px-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 text-left"
            >
              <span>How It Works</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                scrollToSection('workspaces');
              }}
              className="w-full flex items-center justify-between py-2 px-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 text-left"
            >
              <span>Workspaces</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                scrollToSection('security');
              }}
              className="w-full flex items-center justify-between py-2 px-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 text-left"
            >
              <span>Security</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                scrollToSection('faq');
              }}
              className="w-full flex items-center justify-between py-2 px-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 text-left"
            >
              <span>FAQ</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(getDashboardRoute());
                  }}
                  className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg text-center text-sm"
                >
                  Open my workspace
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full py-2 border border-slate-200 text-slate-700 font-medium rounded-lg text-center text-sm"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full py-2.5 border border-slate-300 text-slate-800 font-medium rounded-lg text-center text-sm"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg text-center text-sm flex items-center justify-center gap-1.5"
                >
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
