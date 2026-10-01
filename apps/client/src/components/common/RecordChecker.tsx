import { formatDateTime } from '../../lib/format.js';
import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Search, Loader2 } from 'lucide-react';
import { recordsApi, recordErrorMessage, IntegrityCheck } from '../../api/recordsApi.js';
import { blockchainApi } from '../../api/blockchainApi.js';
import { Button } from './Button.js';

type Result =
  | { kind: 'full'; check: IntegrityCheck }
  | { kind: 'fingerprint'; found: boolean; message: string; recordedAt?: string | null }
  | { kind: 'error'; message: string };

const FINGERPRINT = /^(0x)?[0-9a-fA-F]{64}$/;

const fmtDate = (d?: string | null) =>
  d ? formatDateTime(d) : '';

const Row: React.FC<{ ok: boolean | null; label: string }> = ({ ok, label }) => (
  <li className="flex items-center gap-2 text-xs">
    {ok === true && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
    {ok === false && <XCircle className="h-4 w-4 text-rose-600" aria-hidden="true" />}
    {ok === null && <span className="h-4 w-4 rounded-full border border-slate-300" aria-hidden="true" />}
    <span className={ok === false ? 'font-semibold text-rose-700' : 'text-slate-700'}>{label}</span>
  </li>
);

/**
 * Checks a report for real: by report ID it runs the server's full integrity check
 * (file present, lock intact, opens correctly, fingerprint matches, recorded in the history);
 * by a 64-character fingerprint it looks the file up in the stored record list.
 */
export const RecordChecker: React.FC<{ initialQuery?: string }> = ({ initialQuery = "" }) => {
  const [query, setQuery] = useState(initialQuery);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setResult(null);
    try {
      if (FINGERPRINT.test(q)) {
        const r = await blockchainApi.verifyRecord(q);
        setResult({ kind: 'fingerprint', found: r.verified, message: r.message, recordedAt: r.recordedAt });
      } else {
        const check = await recordsApi.verifyRecord(q);
        setResult({ kind: 'full', check });
      }
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setResult({
          kind: 'error',
          message:
            "The patient hasn't shared this report with you, so it can't be opened for a full check. Ask for the file fingerprint (64 letters and numbers) and check that instead."
        });
      } else if (status === 404) {
        setResult({ kind: 'error', message: 'No report has this ID. Check the number and try again.' });
      } else {
        setResult({ kind: 'error', message: await recordErrorMessage(err) });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <form onSubmit={run} className="mb-2 flex gap-2">
        <label htmlFor="record-check-input" className="sr-only">
          Report ID or file fingerprint
        </label>
        <input
          id="record-check-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Report ID (e.g. 1593418802454) or file fingerprint"
          className="flex-1 rounded-xl border border-slate-300 p-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-500"
        />
        <Button type="submit" size="sm" disabled={busy || !query.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
          <span className="ml-1">Check</span>
        </Button>
      </form>
      <p className="mb-5 text-[11px] text-slate-500">
        A report ID runs the full check. A fingerprint only tells you whether a file with exactly that content is stored here.
      </p>

      {result?.kind === 'full' && (
        <div
          className={`rounded-2xl border p-4 ${result.check.verified ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}
          role="status"
        >
          <p className={`mb-3 flex items-center gap-2 text-sm font-bold ${result.check.verified ? 'text-emerald-800' : 'text-rose-800'}`}>
            {result.check.verified ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            {result.check.verified ? 'Unchanged since upload' : 'This report could not be confirmed'}
          </p>
          {!result.check.verified && result.check.problem && <p className="mb-3 text-xs text-rose-800">{result.check.problem}</p>}
          <ul className="space-y-1.5">
            <Row ok={result.check.fileStored} label="The original file is stored" />
            <Row ok={result.check.ciphertextIntact} label="The locked copy has not been touched" />
            <Row ok={result.check.decrypts} label="It opens correctly with its key" />
            <Row ok={result.check.fingerprintMatches} label="Its content matches the fingerprint taken at upload" />
            <Row ok={result.check.blockchainAnchored} label="Its fingerprint is saved in the record history" />
            {result.check.history?.chain && (
              <li className="text-xs text-slate-700 pl-6">
                {result.check.history.chain.status === 'confirmed' ? (
                  <>
                    Also recorded on {result.check.history.chain.network}
                    {result.check.history.chain.explorerUrl && (
                      <>
                        {' · '}
                        <a className="ml-tap font-bold text-sky-700 underline" href={result.check.history.chain.explorerUrl} target="_blank" rel="noreferrer">
                          view the transaction
                        </a>
                      </>
                    )}
                  </>
                ) : result.check.history.chain.status === 'failed' ? (
                  `Could not be written to ${result.check.history.chain.network} yet.`
                ) : (
                  `Being written to ${result.check.history.chain.network}…`
                )}
              </li>
            )}
          </ul>
          <p className="mt-3 text-[11px] text-slate-500">
            Report {result.check.reportId} · checked {fmtDate(result.check.checkedAt)}
          </p>
        </div>
      )}

      {result?.kind === 'fingerprint' && (
        <div className={`rounded-2xl border p-4 ${result.found ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`} role="status">
          <p className={`mb-1 flex items-center gap-2 text-sm font-bold ${result.found ? 'text-emerald-800' : 'text-amber-800'}`}>
            {result.found ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            {result.found ? 'Fingerprint found' : 'Fingerprint not found'}
          </p>
          <p className="text-xs text-slate-700">{result.message}</p>
          {result.recordedAt && <p className="mt-2 text-[11px] text-slate-500">Uploaded {fmtDate(result.recordedAt)}</p>}
        </div>
      )}

      {result?.kind === 'error' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900" role="alert">
          {result.message}
        </div>
      )}
    </div>
  );
};
