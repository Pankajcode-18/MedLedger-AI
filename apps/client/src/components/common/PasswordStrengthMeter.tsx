import React from 'react';
import { passwordStrength, PASSWORD_RULES_TEXT } from '../../lib/password.js';

export const PasswordStrengthMeter: React.FC<{ password: string }> = ({ password }) => {
  if (!password) {
    return <p className="text-[11px] text-slate-500 mt-1.5">{PASSWORD_RULES_TEXT}</p>;
  }
  const s = passwordStrength(password);
  return (
    <div className="mt-1.5 space-y-1" aria-live="polite">
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${s.barClass}`} />
      </div>
      <div className="flex justify-between text-[11px]">
        <span className="text-slate-500">{PASSWORD_RULES_TEXT}</span>
        <span className={`font-bold ${s.textClass}`}>{s.label}</span>
      </div>
    </div>
  );
};
