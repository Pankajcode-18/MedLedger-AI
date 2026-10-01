import React, { useEffect, useState } from 'react';
import { Check, Search, ShieldCheck, Stethoscope, UserPlus, X } from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { StatusBadge } from '../../components/common/PageKit.js';
import { consentApi, ConsentEntry, DoctorCard } from '../../api/consentApi.js';
import { PatientConsent } from '../../hooks/useConsent.js';
import { formatDate } from '../../lib/format.js';

const doctorLine = (d?: DoctorCard | null) => [d?.specialty, d?.hospitalName, d?.licenseId].filter(Boolean).join(' · ');

const Avatar: React.FC<{ name: string }> = ({ name }) => (
  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0" aria-hidden="true">
    {name
      .replace(/^Dr\.?\s*/i, '')
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()}
  </div>
);

/**
 * Everything about who can see the patient's records, in one place:
 * requests to answer, doctors who can see them now, sharing with a new doctor, and past decisions.
 */
export const PatientPermissions: React.FC<{ consent: PatientConsent }> = ({ consent }) => {
  const { pending, granted, past, busy, act, walletLinked, loaded } = consent;
  const [confirmStop, setConfirmStop] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DoctorCard[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await consentApi.searchDoctors(query));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const grantedIds = new Set(granted.map((g) => g.doctorId));
  const pendingIds = new Set(pending.map((g) => g.doctorId));

  const row = (e: ConsentEntry, right: React.ReactNode, extra?: React.ReactNode) => (
    <li key={`${e.doctorId}-${e.status}`} className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <Avatar name={e.doctorName} />
        <div className="text-xs">
          <p className="font-bold text-slate-900 text-sm">{e.doctorName}</p>
          {doctorLine(e.doctor) && <p className="text-slate-500">{doctorLine(e.doctor)}</p>}
          {extra}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">{right}</div>
    </li>
  );

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> You decide who sees your records
        </h3>
        <p className="text-xs text-slate-600 mt-1">
          Doctors you share with can read your reports, readings and medicines — not change them. You can stop sharing at any time, and every time
          someone opens a file it appears in your Activity.
          {walletLinked && ' Because your MetaMask wallet is linked, you will confirm each change in MetaMask.'}
        </p>
      </Card>

      <section aria-labelledby="req-h" className="space-y-3">
        <h3 id="req-h" className="text-sm font-bold text-slate-900">
          Waiting for your answer {pending.length > 0 && <span className="text-amber-600">({pending.length})</span>}
        </h3>
        {pending.length === 0 ? (
          <p className="text-xs text-slate-500">{loaded ? 'No doctor is waiting for an answer.' : 'Loading…'}</p>
        ) : (
          <ul className="space-y-2.5">
            {pending.map((e) =>
              row(
                e,
                <>
                  <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => act('decline', e.doctorId)}>
                    <X className="w-3.5 h-3.5 mr-1" /> Decline
                  </Button>
                  <Button variant="primary" size="sm" disabled={Boolean(busy)} onClick={() => act('grant', e.doctorId)}>
                    <Check className="w-3.5 h-3.5 mr-1" /> {busy === `grant:${e.doctorId}` ? 'Sharing…' : 'Share my records'}
                  </Button>
                </>,
                <p className="text-slate-600 mt-1">
                  Asked {formatDate(e.requestedAt)}
                  {e.reason ? ` — “${e.reason}”` : ''}
                </p>
              )
            )}
          </ul>
        )}
      </section>

      <section aria-labelledby="now-h" className="space-y-3">
        <h3 id="now-h" className="text-sm font-bold text-slate-900">
          Can see your records now ({granted.length})
        </h3>
        {granted.length === 0 ? (
          <p className="text-xs text-slate-500">Nobody. Your records are private to you.</p>
        ) : (
          <ul className="space-y-2.5">
            {granted.map((e) =>
              row(
                e,
                confirmStop === e.doctorId ? (
                  <>
                    <span className="text-xs text-slate-600">Stop sharing?</span>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmStop(null)}>
                      Keep
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={Boolean(busy)}
                      onClick={async () => {
                        if (await act('revoke', e.doctorId)) setConfirmStop(null);
                      }}
                    >
                      {busy === `revoke:${e.doctorId}` ? 'Stopping…' : 'Yes, stop'}
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setConfirmStop(e.doctorId)}>
                    Stop sharing
                  </Button>
                ),
                <p className="text-emerald-700 mt-1">Shared since {formatDate(e.decidedAt)}</p>
              )
            )}
          </ul>
        )}
      </section>

      <Card className="p-6 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-blue-600" /> Share with a doctor
        </h3>
        <div className="relative sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search doctors by name, specialty or hospital"
            placeholder="Search by name, specialty or hospital"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl"
          />
        </div>
        {searching && results.length === 0 ? (
          <p className="text-xs text-slate-400">Searching…</p>
        ) : results.length === 0 ? (
          <p className="text-xs text-slate-500">No doctor matches that search.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {results.map((d) => (
              <li key={d.doctorId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-3">
                  <Stethoscope className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  <span>
                    <span className="font-bold text-slate-900 block">{d.name}</span>
                    {doctorLine(d) && <span className="text-slate-500">{doctorLine(d)}</span>}
                  </span>
                </span>
                {grantedIds.has(d.doctorId) ? (
                  <StatusBadge status="Active" label="Already shared" />
                ) : (
                  <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => act('grant', d.doctorId)}>
                    {busy === `grant:${d.doctorId}` ? 'Sharing…' : pendingIds.has(d.doctorId) ? 'Accept their request' : 'Share'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {past.length > 0 && (
        <section aria-labelledby="past-h" className="space-y-2">
          <h3 id="past-h" className="text-sm font-bold text-slate-900">
            Past decisions
          </h3>
          <ul className="text-xs divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200">
            {past.map((e) => (
              <li key={`${e.doctorId}-past`} className="px-4 py-2.5 flex items-center justify-between gap-2">
                <span className="text-slate-800">{e.doctorName}</span>
                <span className="text-slate-500">
                  {e.status === 'declined' ? 'You declined' : 'You stopped sharing'} · {formatDate(e.decidedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
