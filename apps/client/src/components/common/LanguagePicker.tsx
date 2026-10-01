import React, { useEffect, useState } from 'react';
import { Languages } from 'lucide-react';
import { getLang, LANGUAGES, Lang, onLangChange, setLang } from '../../i18n/index.js';

/** English / नेपाली / हिन्दी. The choice is remembered on this device. */
export const LanguagePicker: React.FC<{ className?: string; compact?: boolean }> = ({ className = '', compact = false }) => {
  const [lang, setLocal] = useState<Lang>(getLang());
  useEffect(() => onLangChange(setLocal), []);
  return (
    <label className={`relative inline-flex items-center ${className}`} translate="no">
      <span className="sr-only">Language</span>
      <Languages className="w-4 h-4 text-slate-500 absolute left-2.5 pointer-events-none" aria-hidden="true" />
      <select
        value={lang}
        onChange={(e) => void setLang(e.target.value as Lang)}
        aria-label="Language / भाषा"
        className="notranslate appearance-none pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {compact ? l.short : l.label}
          </option>
        ))}
      </select>
    </label>
  );
};
