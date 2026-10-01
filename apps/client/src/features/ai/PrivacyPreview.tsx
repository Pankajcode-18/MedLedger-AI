import React, { useState } from 'react';
import { aiApi } from '../../api/aiApi.js';
import { DeidentifyPreviewResponse } from '../../types/index.js';
import { aiErrorMessage } from './AiResultBlocks.js';
import { AlertTriangle, EyeOff, ShieldCheck, X } from 'lucide-react';

/** Friendly names for the identifier categories reported by the server. */
const CATEGORY_LABEL: Record<string, string> = {
  name: 'Names',
  clinician_name: 'Doctor names',
  facility: 'Hospital / lab names',
  email: 'Emails',
  phone: 'Phone numbers',
  address: 'Addresses',
  date: 'Dates',
  dob: 'Date of birth',
  age: 'Age',
  national_id: 'ID numbers',
  record_id: 'Record / sample numbers',
  insurance_id: 'Insurance numbers',
  license: 'Licence numbers',
  bank_account: 'Bank details',
  payment_card: 'Card numbers',
  vehicle: 'Vehicle numbers',
  device_id: 'Device IDs',
  url: 'Web links',
  ip_address: 'IP addresses',
  wallet: 'Wallet addresses'
};

/** Renders text with every [PLACEHOLDER] highlighted. */
const Highlighted: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\[[A-Z_]+\])/g).map((part, i) =>
      /^\[[A-Z_]+\]$/.test(part) ? (
        <mark key={i} className="px-1 rounded bg-emerald-100 text-emerald-800 font-bold not-italic">
          {part}
        </mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    )}
  </>
);

interface Props {
  reportText?: string;
  patientId?: string;
  reportId?: string;
  /** Button label; defaults to "What the AI sees". */
  label?: string;
}

/**
 * "What the AI sees" — lets patients and doctors check that personal details are removed
 * before any AI processing (Project Guide §7.2).
 */
export const PrivacyPreview: React.FC<Props> = ({ reportText, patientId, reportId, label = 'What the AI sees' }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DeidentifyPreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      setData(await aiApi.deidentifyPreview(reportText?.trim() || undefined, patientId, reportId));
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={load}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 hover:text-emerald-900"
      >
        <EyeOff className="w-3.5 h-3.5" /> {label}
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold text-emerald-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> What the AI sees
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close privacy preview" className="text-slate-400 hover:text-slate-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading && <p className="text-slate-500">Removing personal details…</p>}
      {error && (
        <p role="alert" className="text-rose-700 font-semibold">
          {error}
        </p>
      )}

      {data && !loading && (
        <>
          <p className="text-slate-700">
            {data.redactions === 0
              ? 'No personal details were found in this text.'
              : `${data.redactions} personal detail${data.redactions === 1 ? ' was' : 's were'} replaced with placeholders before any AI analysis.`}
          </p>
          {data.redactions > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.categoryCounts).map(([cat, n]) => (
                <span key={cat} className="px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-800 font-semibold">
                  {CATEGORY_LABEL[cat] || cat}: {n}
                </span>
              ))}
            </div>
          )}
          <div
            className={`flex items-center gap-1.5 font-semibold ${data.safeForExternal ? 'text-emerald-700' : 'text-amber-700'}`}
          >
            {data.safeForExternal ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {data.safeForExternal
              ? 'Independent re-check: no identifiers left.'
              : 'Re-check found something that looks personal — this text will not be sent to an external AI.'}
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed bg-white border border-slate-200 rounded-xl p-3 text-slate-800">
            <Highlighted text={data.text} />
          </pre>
        </>
      )}
    </div>
  );
};
