import React from 'react';
import { Card } from '../components/common/Card.js';
import { ShieldCheck, Lock, Layers, Sparkles } from 'lucide-react';

const POINTS = [
  {
    icon: Lock,
    tone: 'bg-sky-50 text-sky-600',
    title: 'You decide who sees your records',
    text: 'A doctor has to ask before they can see your records. You can say yes, say no, or stop sharing at any time.',
  },
  {
    icon: Layers,
    tone: 'bg-emerald-50 text-emerald-600',
    title: 'Changes are easy to spot',
    text: 'Every file is locked when it is saved, and a short fingerprint of it goes into a record history nobody can edit. If a file is changed later, the check shows it.',
  },
  {
    icon: Sparkles,
    tone: 'bg-indigo-50 text-indigo-600',
    title: 'Reports explained in plain words',
    text: 'The AI assistant explains your reports, lists your readings, and warns about medicines that may not mix well. It does not replace your doctor.',
  },
  {
    icon: ShieldCheck,
    tone: 'bg-amber-50 text-amber-600',
    title: 'Keeps working',
    text: 'If the online record history is slow or unreachable, MedLedger keeps a local copy of the history so you can carry on.',
  },
];

export const AboutPage: React.FC = () => (
  <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-10">
    <div className="text-center space-y-3">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">About MedLedger AI</h1>
      <p className="text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
        Your medical reports are often spread across hospitals, clinics and labs. MedLedger keeps them in one safe place and lets you choose who
        can see them.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {POINTS.map(({ icon: Icon, tone, title, text }) => (
        <Card key={title} className="p-6 space-y-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>
            <Icon className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
        </Card>
      ))}
    </div>

    <details className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
      <summary className="cursor-pointer font-bold text-slate-900">Technical details (for IT teams)</summary>
      <ul className="mt-3 space-y-1 list-disc pl-5">
        <li>Website: React, TypeScript and Vite</li>
        <li>Server: Node.js with Express and TypeScript</li>
        <li>Files: AES-256-GCM encryption; SHA-256 fingerprints</li>
        <li>Record history: Ethereum (Sepolia test network) smart contract, with a local fallback</li>
      </ul>
    </details>
  </div>
);
