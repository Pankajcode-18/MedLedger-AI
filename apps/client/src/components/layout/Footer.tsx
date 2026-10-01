import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, Lock, ArrowUpRight } from 'lucide-react';
import { useUIStore } from '../../store/uiStore.js';

export const Footer: React.FC = () => {


  return (
    <footer className="bg-[#0B1220] text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12 mb-12">
          
          {/* Main Brand Column */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-700/80 p-1 flex items-center justify-center">
                <img src="/logo.png" alt="MedLedger" className="w-full h-full object-contain" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-white tracking-tight">MedLedger</span>
                <span className="bg-blue-900/60 border border-blue-500/40 text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  AI
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              Secure healthcare records with patient-controlled access, record verification, and AI assistance.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 pt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Every file is fingerprinted and every access is recorded</span>
            </div>
          </div>

          {/* Col 1: Platform */}
          <div>
            <h4 className="text-xs font-bold text-white tracking-wider mb-4">Platform</h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  Patient Portal
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  Doctor workspace
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  Hospital Administration
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  Diagnostic Laboratory
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  Insurance &amp; Claims
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  System Administration
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 2: Learn */}
          <div>
            <h4 className="text-xs font-bold text-white tracking-wider mb-4">Learn</h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>
                <a href="/#how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="/#security" className="hover:text-white transition-colors">
                  Security
                </a>
              </li>
              <li>
                <a href="/#faq" className="hover:text-white transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  About MedLedger
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Technology & Support */}
          <div>
            <h4 className="text-xs font-bold text-white tracking-wider mb-4">Technology</h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>
                <a href="/#security" className="hover:text-white transition-colors">
                  How your files are protected
                </a>
              </li>
              <li>
                <a href="/#security" className="hover:text-white transition-colors">
                  Record Verification
                </a>
              </li>
              <li>
                <a href="/#how-it-works" className="hover:text-white transition-colors">
                  AI Assistant
                </a>
              </li>
            </ul>

            <h4 className="text-xs font-bold text-white tracking-wider mt-6 mb-3">Support</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  Contact &amp; Help
                </Link>
              </li>
              <li>
                <span className="text-emerald-400 text-xs font-medium">All Systems Operational</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 MedLedger AI. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/about" className="hover:text-slate-400 transition-colors">
              Privacy
            </Link>
            <Link to="/about" className="hover:text-slate-400 transition-colors">
              Terms
            </Link>
            <a href="/#security" className="hover:text-slate-400 transition-colors">
              Security
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
