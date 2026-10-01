import React from 'react';
import { CheckCircle2, AlertTriangle, Search, X } from 'lucide-react';
import { Badge } from './Badge.js';

/** Small shared building blocks so every workspace page looks and reads the same. */

export const PageHeader: React.FC<{
  tag: string;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ tag, title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs">
    <div>
      <Badge variant="info" className="px-2.5 py-0.5 text-[11px] font-bold mb-1">
        {tag}
      </Badge>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">{title}</h1>
      {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </div>
);

export type Notice = { text: string; tone: 'ok' | 'error' } | null;

export const NoticeBar: React.FC<{ notice: Notice; onClose: () => void }> = ({ notice, onClose }) => {
  if (!notice) return null;
  const ok = notice.tone === 'ok';
  return (
    <div
      role={ok ? 'status' : 'alert'}
      className={`px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm border ${
        ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
      }`}
    >
      <div className="flex items-center gap-2 font-medium">
        {ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
        <span>{notice.text}</span>
      </div>
      <button type="button" onClick={onClose} aria-label="Close message" className="p-1 opacity-70 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  note?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}> = ({ label, value, note, icon, onClick }) => (
  <div
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={(e) => onClick && (e.key === 'Enter' || e.key === ' ') && onClick()}
    className={`p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs ${onClick ? 'cursor-pointer hover:border-slate-300 transition-all' : ''}`}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      {icon && <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">{icon}</div>}
    </div>
    <span className="text-2xl sm:text-3xl font-black text-slate-950 block">{value}</span>
    {note && <span className="text-[11px] text-slate-500 font-medium mt-1 block">{note}</span>}
  </div>
);

export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <div className="relative w-full sm:w-80">
    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
    <input
      type="search"
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

export function FilterChips<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto text-xs" role="group" aria-label="Filter">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
            value === o ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

const inputClass = 'w-full text-xs p-2.5 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500';

export const Field: React.FC<{
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}> = ({ label, value, onChange, type = 'text', placeholder, required, hint }) => {
  const id = `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-slate-700 mb-1">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </label>
      <input id={id} type={type} value={value} placeholder={placeholder} required={required} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
};

export const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}> = ({ label, value, onChange, options }) => {
  const id = `s-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-slate-700 mb-1">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
};

/** Table with a header row and a friendly empty message. Scrolls sideways on narrow screens. */
/**
 * A table on wide screens; on phones (<640px) each row becomes a card with its column name beside each value.
 * Column names are copied onto every cell as data-label after each render (see .ml-table in index.css).
 */
export const SimpleTable: React.FC<{ headers: string[]; empty: string; children: React.ReactNode; count: number }> = ({ headers, empty, children, count }) => {
  const ref = React.useRef<HTMLTableElement>(null);
  React.useLayoutEffect(() => {
    ref.current?.querySelectorAll('tbody tr').forEach((tr) => {
      Array.from(tr.children).forEach((td, i) => {
        if (td.getAttribute('colspan')) return;
        if (headers[i]) td.setAttribute('data-label', headers[i]);
        else td.removeAttribute('data-label');
      });
    });
  });
  return (
    <div className="sm:overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table ref={ref} className="ml-table w-full text-left border-collapse text-xs sm:min-w-[640px]">
        <thead>
          <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold text-[11px]">
            {headers.map((h, i) => (
              <th key={h || `col-${i}`} className={`py-3 px-4 ${i === headers.length - 1 && h === '' ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {count === 0 ? (
            <tr>
              <td colSpan={headers.length} className="py-8 px-4 text-center text-slate-500">
                {empty}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
};

export const StatusBadge: React.FC<{ status: string; label?: string }> = ({ status, label }) => {
  const tone: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    'On duty': 'success',
    'Off duty': 'neutral',
    'On leave': 'warning',
    Admitted: 'info',
    ICU: 'danger',
    Discharged: 'neutral',
    Received: 'neutral',
    Processing: 'warning',
    'Report ready': 'info',
    Uploaded: 'success',
    Submitted: 'info',
    'Needs information': 'warning',
    Approved: 'success',
    Rejected: 'danger',
    Paid: 'success',
    Active: 'success',
    Lapsed: 'neutral',
    Urgent: 'danger',
    Routine: 'neutral',
    Verified: 'success',
    'Not verified': 'warning'
  };
  return (
    <Badge variant={tone[status] || 'neutral'} className="text-[10px]">
      {label || status}
    </Badge>
  );
};
