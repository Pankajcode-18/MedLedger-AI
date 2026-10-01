import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Unlock,
  FileText,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Users,
  Stethoscope,
  Building2,
  FlaskConical,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  KeyRound,
  Eye,
  CheckCheck,
  XCircle,
  Clock,
  ExternalLink,
  HelpCircle,
  UserCheck,
  X,
  FileCheck,
  Activity,
  AlertCircle
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  // Hero interactive console tab
  const [heroTab, setHeroTab] = useState<'vault' | 'access' | 'ai'>('vault');
  const [heroAccessGranted, setHeroAccessGranted] = useState<boolean | null>(null);
  const [heroTooltip, setHeroTooltip] = useState<'verified' | 'access' | null>(null);

  // Patient Permission Interactive Demo state
  const [permState, setPermState] = useState<'waiting' | 'granted' | 'declined'>('waiting');

  // How it works interactive step 3 simulation
  const [step3AccessGranted, setStep3AccessGranted] = useState<boolean | null>(null);

  // FAQ Accordion state (first one open by default)
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  // Security technical details toggle
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Demo Credentials Modal state
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [selectedDemoRole, setSelectedDemoRole] = useState<'patient' | 'doctor' | 'hospital' | 'lab' | 'insurance' | 'admin'>('patient');
  const [copiedDemoDetails, setCopiedDemoDetails] = useState(false);

  // Encryption Explainer Modal
  const [encryptionModalOpen, setEncryptionModalOpen] = useState(false);

  const demoAccounts = {
    patient: {
      title: 'Patient',
      icon: Users,
      email: 'patient@medledger.demo',
      password: 'secret99',
      role: 'Patient',
      description: 'See your reports, choose which doctors can see them, and get plain-language explanations.'
    },
    doctor: {
      title: 'Doctor',
      icon: Stethoscope,
      email: 'doctor@medledger.demo',
      password: 'secret99',
      role: 'Doctor',
      description: 'See records patients share with you, ask for access, add notes and prescriptions, and get AI help.'
    },
    hospital: {
      title: 'Hospital',
      icon: Building2,
      email: 'hospital@medledger.demo',
      password: 'hospital123',
      role: 'Hospital Admin',
      description: 'Manage staff, admit patients, register new patients and see what happens in your hospital.'
    },
    lab: {
      title: 'Laboratory',
      icon: FlaskConical,
      email: 'lab@medledger.demo',
      password: 'lab123',
      role: 'Lab Technician',
      description: 'Track samples, upload lab reports, and check that a report has not been changed.'
    },
    insurance: {
      title: 'Insurance & Claims',
      icon: Shield,
      email: 'insurance@medledger.demo',
      password: 'insurance123',
      role: 'Claims Specialist',
      description: 'Review claims with documents patients choose to share, and check that a document has not been changed.'
    },
    admin: {
      title: 'Administrator',
      icon: ShieldCheck,
      email: 'admin@medledger.demo',
      password: 'admin123',
      role: 'Administrator',
      description: 'Manage accounts, see how the system is running, and look at the full record history.'
    }
  };

  const handleCopyDemo = () => {
    const active = demoAccounts[selectedDemoRole];
    const text = `Email: ${active.email}\nPassword: ${active.password}\nRole: ${active.role}`;
    navigator.clipboard.writeText(text);
    setCopiedDemoDetails(true);
    setTimeout(() => setCopiedDemoDetails(false), 2000);
  };

  const faqs = [
    {
      q: 'Who controls my medical records?',
      a: 'You do. You choose which doctors can see your records, and you can stop sharing at any time.'
    },
    {
      q: 'Can a doctor see my records without permission?',
      a: 'No. A doctor has to ask, and can only see your records after you say yes.'
    },
    {
      q: 'Is my medical file made public?',
      a: 'No. Your file stays locked. Only a short fingerprint of it is saved in the record history, so changes can be spotted.'
    },
    {
      q: 'How does the AI assistant work?',
      a: 'It explains your reports in plain words and points out values to ask your doctor about. It does not replace your doctor.'
    },
    {
      q: 'Can I try MedLedger?',
      a: 'Yes. Pick a sample account on the sign-in page and look around. Nothing you do there is real.',
      hasDemoBtn: true
    }
  ];

  return (
    <div className="min-h-screen bg-[#F7FAFC] text-[#111827] font-sans">

      {/* ================================================================= */}
      {/* 1. HERO SECTION                                                   */}
      {/* ================================================================= */}
      <section className="relative overflow-hidden pt-10 pb-16 lg:pt-16 lg:pb-24 bg-gradient-to-b from-white via-[#F7FAFC] to-[#F7FAFC] border-b border-[#E5E7EB]">
        
        {/* Subtle background ambient circles */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 pointer-events-none opacity-40">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-blue-100 blur-3xl" />
          <div className="absolute top-16 right-10 w-80 h-80 rounded-full bg-cyan-100 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Value Proposition */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* Small Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200/80 rounded-full text-xs font-semibold text-blue-700">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                <span>You choose who sees your records</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0B1220] tracking-tight leading-[1.12]">
                Your Health Records. <br />
                <span className="text-blue-600">Your Privacy.</span> <br />
                Your Choice.
              </h1>

              {/* Supporting Text */}
              <p className="text-base sm:text-lg text-[#64748B] leading-relaxed max-w-xl">
                Keep all your medical reports in one safe place, choose which doctors can see them, and get them explained in plain words.
              </p>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs hover:shadow-md transition-all group"
                >
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-[#111827] bg-white hover:bg-slate-50 border border-[#E5E7EB] hover:border-slate-300 rounded-xl shadow-2xs transition-all"
                >
                  <span>See how it works</span>
                </a>
              </div>

              {/* 4 Small Trust Indicators */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#E5E7EB]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#111827]">
                  <span className="text-sm">🔐</span>
                  <span>Files kept locked</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#111827]">
                  <span className="text-sm">👤</span>
                  <span>Patient-Controlled</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#111827]">
                  <span className="text-sm text-emerald-600">✓</span>
                  <span>Changes are spotted</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#111827]">
                  <span className="text-sm">🧠</span>
                  <span>AI Assistance</span>
                </div>
              </div>

            </div>

            {/* Right Column: Hero Visual - MedLedger Security & Access Hub */}
            <div className="lg:col-span-6">
              <div className="relative mx-auto max-w-lg lg:max-w-none bg-white rounded-2xl border border-[#E5E7EB] shadow-xl p-5 sm:p-6 transition-all">
                
                {/* Console Window Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB]">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-blue-600 tracking-wider block">
                        Example
                      </span>
                      <h3 className="text-sm font-bold text-[#0B1220] tracking-tight">
                        Your health records
                      </h3>
                    </div>
                  </div>

                  {/* Network Status Badge with Tooltip */}
                  <div className="relative">
                    <div
                      onMouseEnter={() => setHeroTooltip('verified')}
                      onMouseLeave={() => setHeroTooltip(null)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-700 cursor-help"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>Unchanged ✓</span>
                    </div>

                    {heroTooltip === 'verified' && (
                      <div className="absolute right-0 top-8 z-20 w-64 p-2.5 bg-[#0B1220] text-white text-xs rounded-xl shadow-xl animate-fade-in">
                        Each file has a fingerprint, so we can show it has not been changed since upload.
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive Navigation Tabs */}
                <div className="flex items-center gap-2 pt-3 pb-4">
                  <button
                    onClick={() => setHeroTab('vault')}
                    className={'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ' + (
                      heroTab === 'vault'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs'
                        : 'text-[#64748B] hover:text-[#111827] hover:bg-slate-50'
                    )}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>My files</span>
                  </button>

                  <button
                    onClick={() => setHeroTab('access')}
                    className={'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ' + (
                      heroTab === 'access'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs'
                        : 'text-[#64748B] hover:text-[#111827] hover:bg-slate-50'
                    )}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Sharing</span>
                  </button>

                  <button
                    onClick={() => setHeroTab('ai')}
                    className={'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ' + (
                      heroTab === 'ai'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs'
                        : 'text-[#64748B] hover:text-[#111827] hover:bg-slate-50'
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>AI Assistant</span>
                  </button>
                </div>

                {/* Tab 1: Encrypted Vault */}
                {heroTab === 'vault' && (
                  <div className="space-y-2.5 animate-fade-in">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100/70 text-blue-600 flex items-center justify-center">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-[#111827] block">Diagnostic Blood Panel.pdf</span>
                          <span className="text-[11px] text-[#64748B]">City Diagnostic Lab • Locked</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Verified
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">Unchanged ✓</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100/70 text-blue-600 flex items-center justify-center">
                          <Stethoscope className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-[#111827] block">Cardiology Assessment &amp; ECG.pdf</span>
                          <span className="text-[11px] text-[#64748B]">Memorial Hospital • Access Controlled</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Verified
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">Unchanged ✓</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100/70 text-indigo-600 flex items-center justify-center">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-[#111827] block">e-Prescription &amp; Dosage Plan</span>
                          <span className="text-[11px] text-[#64748B]">City Clinic • Digital Signature Active</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Verified
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">Signature Valid</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Access Control */}
                {heroTab === 'access' && (
                  <div className="space-y-3 animate-fade-in">
                    {/* Live interactive doctor request */}
                    <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/80 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">👨‍⚕️</span>
                          <div>
                            <span className="font-bold text-[#111827] block">Dr. Anil Sharma</span>
                            <span className="text-[10px] text-blue-700">Cardiology • Requests 48h Record Review</span>
                          </div>
                        </div>
                        {heroAccessGranted === true && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            Shared
                          </span>
                        )}
                        {heroAccessGranted === false && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                            Request Declined
                          </span>
                        )}
                        {heroAccessGranted === null && (
                          <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded">
                            Awaiting Your Decision
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => setHeroAccessGranted(false)}
                          className="flex-1 py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => setHeroAccessGranted(true)}
                          className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          Share
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-2">
                      <span className="text-[11px] font-bold text-slate-500 tracking-wider block">
                        Active Authorizations
                      </span>
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Memorial Hospital Care Team</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Active</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-amber-500" />
                          <span>Insurance Claims Review</span>
                        </span>
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Needs your OK</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: AI Assistant */}
                {heroTab === 'ai' && (
                  <div className="space-y-3 animate-fade-in text-xs">
                    <div className="p-3.5 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-xl border border-blue-200/80 space-y-2">
                      <div className="flex items-center gap-2 text-blue-700 font-bold">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span>AI Clinical Synthesis</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed text-xs">
                        "Your recent laboratory diagnostic markers from your lab and hospital are within normal clinical reference ranges. No drug interactions or conflicts were identified."
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className="text-[10px] font-semibold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                          ✓ Jargon-Free Summary
                        </span>
                        <span className="text-[10px] font-semibold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                          ✓ Interaction Check Passed
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                          ✓ Private &amp; Anonymous
                        </span>
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-[#64748B] italic">
                      AI supports healthcare professionals and patient understanding. It does not replace medical advice.
                    </div>
                  </div>
                )}

                {/* Bottom Status Bar with Hover Tooltips */}
                <div className="mt-4 pt-3 border-t border-[#E5E7EB] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#64748B]">
                    <span>Record Protection:</span>
                    <span className="font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Locked – only people you allow can open it
                    </span>
                  </div>

                  <div className="relative">
                    <div
                      onMouseEnter={() => setHeroTooltip('access')}
                      onMouseLeave={() => setHeroTooltip(null)}
                      className="flex items-center gap-1 text-[#64748B] cursor-help font-medium hover:text-[#111827]"
                    >
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>Control:</span>
                      <span className="font-semibold text-[#111827]">Patient-Governed</span>
                    </div>

                    {heroTooltip === 'access' && (
                      <div className="absolute right-0 bottom-7 z-20 w-64 p-2.5 bg-[#0B1220] text-white text-xs rounded-xl shadow-xl animate-fade-in">
                        Only you decide who can open your files.
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Interactive Demo Link */}
                <div className="mt-3.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">
                    See how sharing works:
                  </span>
                  <a
                    href="#permission-demo"
                    className="ml-tap font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <span>Try it below</span>
                    <ArrowRight className="w-3 h-3" />
                  </a>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. TRUST CARDS (Directly below Hero - Real Features, No Fake %)     */}
      {/* ================================================================= */}
      <section className="py-12 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="p-6 rounded-2xl bg-[#F7FAFC] border border-[#E5E7EB] hover:border-slate-300 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1220] mb-1.5">Files kept locked</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Files are locked before they are saved, so people you have not allowed cannot read them.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#F7FAFC] border border-[#E5E7EB] hover:border-slate-300 transition-all">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1220] mb-1.5">Patient Control</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Patients manage and review which healthcare providers can access their records.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#F7FAFC] border border-[#E5E7EB] hover:border-slate-300 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1220] mb-1.5">Record Verification</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Unique digital fingerprints help detect any unexpected changes to medical files.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#F7FAFC] border border-[#E5E7EB] hover:border-slate-300 transition-all">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1220] mb-1.5">Record history</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Every upload and share is written into a history that nobody can edit.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 3. WHAT IS MEDLEDGER?                                             */}
      {/* ================================================================= */}
      <section className="py-16 sm:py-20 bg-[#F7FAFC] border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-2xl mx-auto text-center space-y-4 mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1220] tracking-tight">
              Healthcare Records, Made Easier
            </h2>
            <p className="text-base text-[#64748B] leading-relaxed">
              Medical records can be spread across hospitals, clinics, laboratories, and insurance systems. MedLedger brings important records into one secure platform while giving patients more control over who can access them.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <div className="bg-white p-8 rounded-2xl border border-[#E5E7EB] shadow-2xs hover:shadow-sm transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#0B1220]">Your Records</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Keep your healthcare information organized in one place, from clinical lab results to doctor summaries.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-[#E5E7EB] shadow-2xs hover:shadow-sm transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#0B1220]">Your Permission</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Choose who can access your records. Say yes to doctors who ask, and stop sharing whenever you want.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-[#E5E7EB] shadow-2xs hover:shadow-sm transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#0B1220]">Your History</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                See what happened to your records and when. Every upload, check and share is written down.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ================================================================= */}
      {/* 4. SIX HEALTHCARE WORKSPACES                                      */}
      {/* ================================================================= */}
      <section id="workspaces" className="py-16 sm:py-24 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="space-y-3 max-w-2xl">
              <span className="text-xs font-bold text-blue-600 tracking-wider">
                Tailored Environments
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1220] tracking-tight">
                One Platform for Everyone Involved in Your Care
              </h2>
              <p className="text-base text-[#64748B]">
                Each person gets a workspace designed around the work they actually need to do.
              </p>
            </div>

            {/* Try Demo Button opening clean modal */}
            <button
              onClick={() => setDemoModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-[#E5E7EB] rounded-xl text-sm font-semibold text-[#111827] transition-all self-start md:self-auto"
            >
              <span>Try Demo</span>
              <ArrowRight className="w-4 h-4 text-blue-600" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. Patient Portal */}
            <div className="p-7 rounded-2xl bg-[#F7FAFC] border border-[#E5E7EB] hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#E5E7EB] shadow-2xs flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0B1220]">Patient workspace</h3>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">
                    Your health records, under your control.
                  </p>
                </div>
                <p className="text-sm text-[#64748B] leading-relaxed">
                  View your medical records, manage access requests, download reports, and understand important information with AI assistance.
                </p>
                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-500 tracking-wider block mb-2">Key Features</span>
                  <ul className="space-y-1.5 text-xs text-[#111827]">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>View medical records</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Say yes or no to requests</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Stop sharing</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>View activity</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="pt-6">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-2.5 px-4 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 2. Physician Workspace */}
            <div className="p-7 rounded-2xl bg-[#F7FAFC] border border-[#E5E7EB] hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#E5E7EB] shadow-2xs flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0B1220]">Doctor workspace</h3>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">
                    Find the information you need to care for your patients.
                  </p>
                </div>
                <p className="text-sm text-[#64748B] leading-relaxed">
                  See records patients share with you, ask for access, add reports, and get AI help.
                </p>
                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-500 tracking-wider block mb-2">Key Features</span>
                  <ul className="space-y-1.5 text-xs text-[#111827]">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Patient search</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Medical records</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Access requests</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>AI summaries</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="pt-6">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-2.5 px-4 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 3. Hospital Administration */}
            <div className="p-7 rounded-2xl bg-[#F7FAFC] border border-[#E5E7EB] hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#E5E7EB] shadow-2xs flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0B1220]">Hospital Administration</h3>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">
                    Manage patients, staff, and hospital records.
                  </p>
                </div>
                <p className="text-sm text-[#64748B] leading-relaxed">
                  Manage staff, register and admit patients, and keep track of prescriptions.
                </p>
                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-500 tracking-wider block mb-2">Key Features</span>
                  <ul className="space-y-1.5 text-xs text-[#111827]">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Patient management</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Staff management</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Admissions</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Prescriptions</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="pt-6">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-2.5 px-4 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 4. Diagnostic Laboratory */}
            <div className="p-7 rounded-2xl bg-[#F7FAFC] border border-[#E5E7EB] hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#E5E7EB] shadow-2xs flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <FlaskConical className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0B1220]">Diagnostic Laboratory</h3>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">
                    Manage tests and reports securely.
                  </p>
                </div>
                <p className="text-sm text-[#64748B] leading-relaxed">
                  Register samples, upload diagnostic reports, and verify that records remain unchanged with digital signatures.
                </p>
                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-500 tracking-wider block mb-2">Key Features</span>
                  <ul className="space-y-1.5 text-xs text-[#111827]">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Sample management</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Report uploads</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verification</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Laboratory history</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="pt-6">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-2.5 px-4 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 5. Insurance & Claims */}
            <div className="p-7 rounded-2xl bg-[#F7FAFC] border border-[#E5E7EB] hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#E5E7EB] shadow-2xs flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0B1220]">Insurance &amp; Claims</h3>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">
                    Review claims using information the patient has approved.
                  </p>
                </div>
                <p className="text-sm text-[#64748B] leading-relaxed">
                  Review documents patients share, check they have not been changed, and decide on claims.
                </p>
                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-500 tracking-wider block mb-2">Key Features</span>
                  <ul className="space-y-1.5 text-xs text-[#111827]">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Claims review</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Patient-approved records</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verification checks</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Review history</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="pt-6">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-2.5 px-4 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 6. System Administration */}
            <div className="p-7 rounded-2xl bg-[#F7FAFC] border border-[#E5E7EB] hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#E5E7EB] shadow-2xs flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0B1220]">System Administration</h3>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">
                    Keep the platform running safely.
                  </p>
                </div>
                <p className="text-sm text-[#64748B] leading-relaxed">
                  Manage accounts, watch how the system is running, and see the full record history.
                </p>
                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-500 tracking-wider block mb-2">Key Features</span>
                  <ul className="space-y-1.5 text-xs text-[#111827]">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>User management</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>System health</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Security activity</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Record history</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="pt-6">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-2.5 px-4 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ================================================================= */}
      {/* 5. HOW IT WORKS (4-Step Timeline)                                 */}
      {/* ================================================================= */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-[#F7FAFC] border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-2xl mx-auto text-center space-y-4 mb-16">
            <span className="text-xs font-bold text-blue-600 tracking-wider">
              Step-by-Step Security
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1220] tracking-tight">
              How MedLedger Keeps Your Records Safe
            </h2>
            <p className="text-base text-[#64748B]">
              Four simple steps protect your records while keeping access under your control.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            
            {/* Step 01 */}
            <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-xs font-mono font-bold text-blue-600">01</span>
                <h3 className="text-base font-bold text-[#0B1220]">Secure Your Record</h3>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded inline-block">
                  Your file is protected
                </span>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  When a report is uploaded, it is locked before it is saved.
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-[#64748B]">
                  Your file is scrambled so people you have not allowed cannot read it.
                </div>
              </div>
              <div className="pt-4 mt-2">
                <button
                  onClick={() => setEncryptionModalOpen(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>How locking works</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Step 02 */}
            <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-xs font-mono font-bold text-blue-600">02</span>
                <h3 className="text-base font-bold text-[#0B1220]">Create a Digital Fingerprint</h3>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded inline-block">
                  Help verify the original record
                </span>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  A unique digital fingerprint is created for the file.
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-[#64748B]">
                  If the file changes later, its fingerprint changes too. This helps detect unexpected changes.
                </div>
              </div>
              <div className="pt-4 mt-2 text-xs font-mono text-slate-500 truncate">
                Fingerprint: a8f2…e3b9
              </div>
            </div>

            {/* Step 03: Interactive Mini UI */}
            <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-xs font-mono font-bold text-blue-600">03</span>
                <h3 className="text-base font-bold text-[#0B1220]">You Give Permission</h3>
                <span className="text-xs font-semibold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded inline-block">
                  You decide who can access
                </span>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  A doctor can ask to see your records, but only you decide whether to share.
                </p>
                
                {/* Mini UI requested in section 18 */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#111827]">Dr. Sharma requested access</span>
                    {step3AccessGranted === true && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">Shared</span>
                    )}
                    {step3AccessGranted === false && (
                      <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-bold">Declined</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => setStep3AccessGranted(false)}
                      className="py-1 px-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium text-[11px]"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => setStep3AccessGranted(true)}
                      className="py-1 px-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold text-[11px]"
                    >
                      Share
                    </button>
                  </div>
                </div>
              </div>
              <div className="pt-2 text-[11px] text-[#64748B]">
                Interactive preview
              </div>
            </div>

            {/* Step 04 */}
            <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-xs font-mono font-bold text-blue-600">04</span>
                <h3 className="text-base font-bold text-[#0B1220]">AI Helps You Understand</h3>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded inline-block">
                  Make medical info clearer
                </span>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  AI can help summarize reports, organize important information, and identify values or medication combinations that may need professional review.
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-[#64748B] italic">
                  AI supports healthcare professionals. It does not replace a qualified medical professional.
                </div>
              </div>
              <div className="pt-4 mt-2 text-xs font-medium text-blue-600 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Clinical Assistant</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ================================================================= */}
      {/* 6. PATIENT PERMISSION DEMO (Section 19 Interactive 2-Panel)       */}
      {/* ================================================================= */}
      <section id="permission-demo" className="py-16 sm:py-24 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-2xl mx-auto text-center space-y-4 mb-14">
            <span className="text-xs font-bold text-blue-600 tracking-wider">
              Interactive Simulation
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1220] tracking-tight">
              See How Patient Permission Works
            </h2>
            <p className="text-base text-[#64748B]">
              A doctor requests access. You decide what happens next.
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            
            {/* Left Panel: Doctor's Request */}
            <div className="p-7 rounded-2xl bg-[#F7FAFC] border border-[#E5E7EB] shadow-xs flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                  <span className="text-xs font-bold text-[#64748B] tracking-wider">
                    Doctor's Request
                  </span>
                  <span className="text-xl">👨‍⚕️</span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-[#0B1220]">Dr. Anil Sharma</h3>
                  <span className="text-xs font-semibold text-blue-600">Cardiology</span>
                </div>

                <div className="space-y-1 text-xs">
                  <span className="text-[#64748B] block">Requests access to:</span>
                  <span className="font-bold text-[#111827] block text-sm">Blood Test Report</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#E5E7EB] text-xs text-[#64748B]">
                  <span className="font-semibold text-[#111827] block mb-0.5">Reason:</span>
                  "Reviewing your recent results."
                </div>

                <div className="pt-2">
                  <span className="text-xs text-[#64748B] block mb-1">Status:</span>
                  {permState === 'waiting' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-800">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Waiting for your decision</span>
                    </span>
                  )}
                  {permState === 'granted' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Approved by you</span>
                    </span>
                  )}
                  {permState === 'declined' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 rounded-full text-xs font-semibold text-rose-800">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Declined by you</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-6 border-t border-[#E5E7EB] mt-4">
                <button
                  onClick={() => setPermState('declined')}
                  className="py-2.5 px-4 bg-white hover:bg-slate-100 border border-[#E5E7EB] rounded-xl text-sm font-semibold text-slate-700 transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={() => setPermState('granted')}
                  className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  Share
                </button>
              </div>
            </div>

            {/* Right Panel: Your Control */}
            <div className="p-7 rounded-2xl bg-white border border-[#E5E7EB] shadow-md flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                  <span className="text-xs font-bold text-[#64748B] tracking-wider">
                    Your Control
                  </span>
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                </div>

                {permState === 'waiting' && (
                  <div className="space-y-3 py-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 mx-auto">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div className="text-center space-y-1">
                      <h4 className="text-base font-bold text-[#0B1220]">
                        Record currently protected
                      </h4>
                      <p className="text-xs text-[#64748B] leading-relaxed max-w-xs mx-auto">
                        Dr. Sharma cannot view your medical file until you authorize the request.
                      </p>
                    </div>
                  </div>
                )}

                {permState === 'granted' && (
                  <div className="space-y-3 py-4 animate-fade-in">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="text-center space-y-1">
                      <h4 className="text-base font-bold text-emerald-800">
                        ✓ Shared with Dr. Sharma
                      </h4>
                      <p className="text-xs text-[#64748B] leading-relaxed max-w-xs mx-auto">
                        Dr. Sharma can now see this record. You can stop sharing at any time.
                      </p>
                    </div>
                  </div>
                )}

                {permState === 'declined' && (
                  <div className="space-y-3 py-4 animate-fade-in">
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 mx-auto">
                      <XCircle className="w-6 h-6" />
                    </div>
                    <div className="text-center space-y-1">
                      <h4 className="text-base font-bold text-rose-800">
                        ✕ You said no
                      </h4>
                      <p className="text-xs text-[#64748B] leading-relaxed max-w-xs mx-auto">
                        Dr. Sharma cannot view this record. Your medical file remains securely locked.
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-[#64748B]">
                  <strong>Zero-Trust Guarantee:</strong> Permissions are evaluated instantly. No third party can bypass your decision.
                </div>
              </div>

              {/* Revoke / Reset button */}
              <div className="pt-6 border-t border-[#E5E7EB] mt-4">
                {permState === 'granted' ? (
                  <button
                    onClick={() => setPermState('waiting')}
                    className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Stop sharing</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setPermState('waiting')}
                    className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-sm font-semibold transition-colors"
                  >
                    Reset Simulation
                  </button>
                )}
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ================================================================= */}
      {/* 7. SECURITY SECTION (Section 20)                                  */}
      {/* ================================================================= */}
      <section id="security" className="py-16 sm:py-24 bg-[#F7FAFC] border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-2xl mx-auto text-center space-y-4 mb-14">
            <span className="text-xs font-bold text-blue-600 tracking-wider">
              Protected by Design
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1220] tracking-tight">
              Security You Can Understand
            </h2>
            <p className="text-base text-[#64748B]">
              Strong technology works behind the scenes so you can focus on your healthcare.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            
            <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1220]">Locked files</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Only people you allow can open your files.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1220]">Digital Fingerprints</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Helps identify unexpected changes to records.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1220]">Record history</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Keeps a history of uploads and shares that nobody can edit.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1220]">Access Controls</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                People only see what they have been allowed to see.
              </p>
            </div>

          </div>

          {/* Expandable Technical Details Button per Section 20 */}
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => setShowTechDetails(!showTechDetails)}
              className="w-full py-3 px-5 bg-white hover:bg-slate-50 border border-[#E5E7EB] rounded-xl text-sm font-semibold text-slate-700 flex items-center justify-between transition-all"
            >
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <span>Technical details (for IT teams)</span>
              </span>
              {showTechDetails ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {showTechDetails && (
              <div className="mt-3 p-6 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs space-y-4 animate-fade-in text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-mono font-bold text-blue-600 block">AES-256-GCM</span>
                    <span className="text-slate-500 mt-1 block">
                      Client-side symmetric authenticated encryption with initialization vector (IV) per record.
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-mono font-bold text-blue-600 block">SHA-256</span>
                    <span className="text-slate-500 mt-1 block">
                      Deterministic cryptographic digest generation verifying file integrity against bit flips.
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-mono font-bold text-blue-600 block">Ethereum Sepolia</span>
                    <span className="text-slate-500 mt-1 block">
                      Decentralized smart contract consensus confirming timestamped proof-of-existence.
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-mono font-bold text-blue-600 block">Role-Based Access (RBAC)</span>
                    <span className="text-slate-500 mt-1 block">
                      Granular, tokenized session authorization with explicit patient consent validation.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ================================================================= */}
      {/* 8. ACTIVITY HISTORY SECTION (Section 21)                          */}
      {/* ================================================================= */}
      <section className="py-16 sm:py-24 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-2xl mx-auto text-center space-y-4 mb-14">
            <span className="text-xs font-bold text-blue-600 tracking-wider">
              Transparent Records
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1220] tracking-tight">
              Always Know What Happened
            </h2>
            <p className="text-base text-[#64748B]">
              See when your records were uploaded, accessed, shared, or verified.
            </p>
          </div>

          <div className="max-w-2xl mx-auto bg-[#F7FAFC] rounded-2xl border border-[#E5E7EB] p-6 sm:p-8">
            
            {/* Today Group */}
            <div className="mb-6">
              <span className="text-xs font-bold text-blue-600 tracking-wider block mb-4">
                Today
              </span>
              <div className="space-y-3">
                
                <div className="flex items-start justify-between p-3.5 bg-white rounded-xl border border-[#E5E7EB] text-xs">
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-600 mt-0.5 font-bold">✓</span>
                    <div>
                      <span className="font-bold text-[#111827] block">Checked – unchanged</span>
                      <span className="text-[#64748B]">Blood Test Report</span>
                    </div>
                  </div>
                  <span className="text-xs text-[#64748B] font-mono">10:45 AM</span>
                </div>

                <div className="flex items-start justify-between p-3.5 bg-white rounded-xl border border-[#E5E7EB] text-xs">
                  <div className="flex items-start gap-3">
                    <span className="text-blue-600 mt-0.5">🔐</span>
                    <div>
                      <span className="font-bold text-[#111827] block">Shared with doctor</span>
                      <span className="text-[#64748B]">Dr. Anil Sharma</span>
                    </div>
                  </div>
                  <span className="text-xs text-[#64748B] font-mono">10:44 AM</span>
                </div>

                <div className="flex items-start justify-between p-3.5 bg-white rounded-xl border border-[#E5E7EB] text-xs">
                  <div className="flex items-start gap-3">
                    <span className="text-cyan-600 mt-0.5">📄</span>
                    <div>
                      <span className="font-bold text-[#111827] block">Report uploaded</span>
                      <span className="text-[#64748B]">Himal Care Hospital</span>
                    </div>
                  </div>
                  <span className="text-xs text-[#64748B] font-mono">10:42 AM</span>
                </div>

              </div>
            </div>

            {/* Yesterday Group */}
            <div>
              <span className="text-xs font-bold text-slate-500 tracking-wider block mb-4">
                Yesterday
              </span>
              <div className="space-y-3">
                <div className="flex items-start justify-between p-3.5 bg-white rounded-xl border border-[#E5E7EB] text-xs">
                  <div className="flex items-start gap-3">
                    <span className="text-rose-600 mt-0.5">🔒</span>
                    <div>
                      <span className="font-bold text-[#111827] block">Stopped sharing</span>
                      <span className="text-[#64748B]">Dr. Michael Brown</span>
                    </div>
                  </div>
                  <span className="text-xs text-[#64748B] font-mono">4:20 PM</span>
                </div>
              </div>
            </div>

            {/* View Full Activity History Button */}
            <div className="pt-6 mt-6 border-t border-[#E5E7EB] text-center">
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold shadow-2xs transition-all"
              >
                <span>Sign in to see your activity</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* 9. RECORD HISTORY */}
      <section className="py-16 sm:py-24 bg-[#F7FAFC] border-b border-[#E5E7EB]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <span className="text-xs font-bold text-blue-600 tracking-wider">Record history</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1220] tracking-tight">Proof that nothing was changed</h2>
          <p className="text-base text-[#64748B]">
            When a file is added, MedLedger saves a short fingerprint of it in a record history that nobody can edit. Later, anyone you allow can
            check that the file is still the same as the day it was uploaded.
          </p>
          <p className="text-sm text-[#64748B]">Your medical file itself is never made public. Only the fingerprint is saved.</p>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 10. FAQ SECTION (Section 23)                                      */}
      {/* ================================================================= */}
      <section id="faq" className="py-16 sm:py-24 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-2xl mx-auto text-center space-y-4 mb-14">
            <span className="text-xs font-bold text-blue-600 tracking-wider">
              Answers &amp; Clarity
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1220] tracking-tight">
              Questions You May Have
            </h2>
            <p className="text-base text-[#64748B]">
              Simple answers about privacy, access, AI, and verification.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#F7FAFC] border border-[#E5E7EB] rounded-2xl overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-[#0B1220] text-base hover:text-blue-600 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <span className="shrink-0 text-slate-400">
                      {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 text-sm text-[#64748B] leading-relaxed border-t border-[#E5E7EB]/60 pt-3 space-y-3">
                      <p>{faq.a}</p>
                      {faq.hasDemoBtn && (
                        <div className="pt-2">
                          <button
                            onClick={() => setDemoModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            <span>Try a Demo</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ================================================================= */}
      {/* 11. FINAL CTA (Section 24)                                        */}
      {/* ================================================================= */}
      <section className="py-16 sm:py-24 bg-[#0B1220] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Your Health Records. Your Control.
          </h2>
          
          <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed">
            Keep your medical information organized, control access, and understand important records more easily.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-base shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <span>Sign in</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDemoModalOpen(true)}
              className="w-full sm:w-auto px-7 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-xl text-base transition-all flex items-center justify-center gap-2"
            >
              <span>Try a demo</span>
            </button>
          </div>

          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span>🔐</span>
              <span>Secure</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span>👤</span>
              <span>Patient-controlled</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span>
              <span>Record verification</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span>🧠</span>
              <span>AI assistance</span>
            </span>
          </div>

        </div>
      </section>

      {/* ================================================================= */}
      {/* 12. DEMO CREDENTIALS MODAL (Section 17)                           */}
      {/* ================================================================= */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E5E7EB] p-6 space-y-5">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h3 className="text-lg font-bold text-[#0B1220]">Try a sample account</h3>
              <button
                onClick={() => setDemoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-[#64748B] block">Choose a workspace:</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(['patient', 'doctor', 'hospital', 'lab', 'insurance', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedDemoRole(r)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold capitalize transition-all text-left flex items-center gap-1.5 ${
                      selectedDemoRole === r
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span>{r}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Demo Info */}
            <div className="p-4 bg-[#F7FAFC] rounded-xl border border-[#E5E7EB] space-y-3 text-xs">
              <div>
                <span className="font-bold text-sm text-[#0B1220] block">
                  {demoAccounts[selectedDemoRole].title}
                </span>
                <p className="text-[#64748B] mt-0.5">
                  {demoAccounts[selectedDemoRole].description}
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#E5E7EB]">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Demo Email:</span>
                  <span className="font-mono font-bold text-[#111827]">
                    {demoAccounts[selectedDemoRole].email}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Demo Password:</span>
                  <span className="font-mono font-bold text-[#111827]">
                    {demoAccounts[selectedDemoRole].password}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleCopyDemo}
                className="py-2.5 px-4 bg-white hover:bg-slate-50 border border-[#E5E7EB] rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                {copiedDemoDetails ? (
                  <span className="text-emerald-600 font-bold">✓ Copied</span>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy email and password</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setDemoModalOpen(false);
                  navigate('/login');
                }}
                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Go to sign in</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 13. ENCRYPTION EXPLAINER MODAL                                     */}
      {/* ================================================================= */}
      {encryptionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E5E7EB] p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-bold text-[#0B1220]">How locking works</h3>
              </div>
              <button
                onClick={() => setEncryptionModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[#64748B] leading-relaxed">
              When you upload a report, MedLedger scrambles it before saving it, so it cannot be read without a key.
            </p>

            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 font-semibold text-[#111827]">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">1</span>
                <span>Original File Protected</span>
              </div>
              <p className="text-[#64748B] pl-7">
                Your report is turned into unreadable text before it is saved.
              </p>
            </div>

            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 font-semibold text-[#111827]">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">2</span>
                <span>Only Authorized Eyes</span>
              </div>
              <p className="text-[#64748B] pl-7">
                Only doctors or organisations you approve can open it.
              </p>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setEncryptionModalOpen(false)}
                className="py-2 px-4 bg-blue-600 text-white font-semibold rounded-xl"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
