import React from 'react';
import { AiAbnormalValue, AiEngine, DrugInteractionResponse } from '../../types/index.js';
import { AlertTriangle, CheckCircle2, ShieldCheck, Cpu, Sparkles } from 'lucide-react';

/** Shows which engine produced a result and how many identifiers were removed first. */
export const EngineBadge: React.FC<{ engine?: AiEngine; redactions?: number; notice?: string }> = ({ engine, redactions, notice }) => (
  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
        engine === 'openai' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-slate-100 text-slate-700 border-slate-200'
      }`}
      title={
        engine === 'openai'
          ? 'Explained by AI using the file with personal details removed; numbers checked against normal ranges'
          : 'Built-in engine: reference ranges and drug knowledge base; nothing left the server'
      }
    >
      {engine === 'openai' ? <Sparkles className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
      {engine === 'openai' ? 'AI + normal ranges' : 'Built-in medical checker'}
    </span>
    {redactions !== undefined && (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
        <ShieldCheck className="w-3 h-3" />
        {redactions} personal detail{redactions === 1 ? '' : 's'} removed first
      </span>
    )}
    {notice && (
      <p role="note" className="basis-full flex items-start gap-1 font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
        {notice}
      </p>
    )}
  </div>
);

const SEVERITY_STYLE: Record<string, string> = {
  'requires attention': 'bg-rose-100 text-rose-800 border-rose-200',
  moderate: 'bg-amber-100 text-amber-800 border-amber-200',
  mild: 'bg-sky-100 text-sky-800 border-sky-200'
};

export const AbnormalValuesTable: React.FC<{ values: AiAbnormalValue[] }> = ({ values }) => {
  if (!values.length) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        No values outside the reference ranges were found.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-slate-500 text-left">
          <tr>
            <th className="p-2.5 font-semibold">Test</th>
            <th className="p-2.5 font-semibold">Result</th>
            <th className="p-2.5 font-semibold">Normal range</th>
            <th className="p-2.5 font-semibold">Level</th>
          </tr>
        </thead>
        <tbody>
          {values.map((v) => (
            <tr key={v.test} className="border-t border-slate-100 align-top">
              <td className="p-2.5">
                <span className="font-bold text-slate-900 block">{v.test}</span>
                <span className="text-slate-500">{v.explanation}</span>
              </td>
              <td className="p-2.5 font-bold whitespace-nowrap">
                <span className={v.status === 'high' ? 'text-rose-700' : 'text-sky-700'}>
                  {v.value} {v.status === 'high' ? '▲' : '▼'}
                </span>
                {v.uncertain && (
                  <span
                    className="block mt-1 w-fit px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800 text-[10px] font-bold"
                    title="This number was hard to read in the scan"
                  >
                    Check against the report
                  </span>
                )}
              </td>
              <td className="p-2.5 text-slate-600 whitespace-nowrap">{v.referenceRange}</td>
              <td className="p-2.5">
                <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold capitalize ${SEVERITY_STYLE[v.severity]}`}>
                  {v.severity}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const DrugAlertsList: React.FC<{ data: DrugInteractionResponse; audience?: 'patient' | 'clinician' }> = ({ data, audience = 'clinician' }) => (
  <div className="space-y-3">
    <div
      className={`p-3.5 rounded-xl border flex items-center gap-2 text-sm font-bold ${
        data.hasSevereConflict ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
      }`}
    >
      {data.hasSevereConflict ? <AlertTriangle className="w-5 h-5 text-rose-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
      {data.hasSevereConflict
        ? 'High-risk combination found'
        : data.alerts.length
          ? `${data.alerts.length} caution${data.alerts.length === 1 ? '' : 's'} found`
          : 'No known interactions between these medicines'}
    </div>

    {data.alerts.map((a, i) => (
      <div key={i} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-sm text-slate-900">{a.drugs.join(' + ')}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
              a.severity === 'high'
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : a.severity === 'moderate'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {a.kind === 'allergy' ? 'ALLERGY' : a.kind === 'duplicate' ? 'DUPLICATE' : `${a.severity.toUpperCase()} RISK`}
          </span>
        </div>
        <p className="text-xs text-slate-700">{a.description}</p>
        <p className="text-xs text-sky-900 bg-sky-50 p-2 rounded-lg border border-sky-100">
          <strong>{audience === 'patient' ? 'What to do: ' : 'Suggested action: '}</strong>
          {audience === 'patient' ? 'Talk to your doctor or pharmacist before taking these together. ' : ''}
          {a.actionableAdvice}
        </p>
      </div>
    ))}

    {data.unrecognised.length > 0 && (
      <p className="text-[11px] text-slate-500">
        Not in the built-in medicine list (not checked): {data.unrecognised.join(', ')}.
      </p>
    )}
    <p className="text-[11px] text-slate-500">{data.safetyDisclaimer}</p>
  </div>
);

/** Pulls the server's error message out of an axios error. */
export const aiErrorMessage = (err: unknown): string =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
  'The AI assistant could not complete this request. Please try again.';
