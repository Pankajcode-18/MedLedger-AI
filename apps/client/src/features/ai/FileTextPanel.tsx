import React, { useCallback, useEffect, useRef, useState } from 'react';
import { recordsApi, recordErrorMessage, RecordTextResponse } from '../../api/recordsApi.js';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileSearch, Loader2, PencilLine, RefreshCw, ScanText } from 'lucide-react';

const METHOD_LABEL: Record<string, string> = {
  'pdf-text': "Read from the PDF's text",
  ocr: 'Read from a scan or photo',
  'pdf-text+ocr': 'Read from the PDF, including scanned pages',
  docx: 'Read from the Word document',
  plain: 'Read from the text file',
  unsupported: 'Text cannot be read from this file type'
};

const POLL_MS = 2000;
/** Below this, the server keeps AI analysis on the built-in engine until a person checks the text. */
const TRUSTED_CONFIDENCE = 80;
const MAX_POLLS = 90; // ~3 minutes

/**
 * Shows what text was read from the uploaded file (PDF text layer / OCR), waits while a scan is
 * still being read, and tells the parent when new text is ready so the AI explanation can refresh.
 */
export const FileTextPanel: React.FC<{ reportId: string; onTextReady?: () => void }> = ({ reportId, onTextReady }) => {
  const [data, setData] = useState<RecordTextResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const polls = useRef(0);
  const wasWaiting = useRef(false);
  // keep the latest callback without restarting the polling effect on every parent render
  const onReady = useRef(onTextReady);
  onReady.current = onTextReady;

  const load = useCallback(async () => {
    try {
      const d = await recordsApi.getText(reportId);
      setData(d);
      setError(null);
      const waiting = d.extraction.status === 'pending' || d.extraction.status === 'processing';
      if (!waiting && wasWaiting.current && d.extraction.status === 'done') onReady.current?.();
      wasWaiting.current = waiting;
      return waiting;
    } catch (e) {
      setError(await recordErrorMessage(e));
      return false;
    }
  }, [reportId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    polls.current = 0;
    wasWaiting.current = false;
    setData(null);
    setOpen(false);
    setEditing(false);
    const tick = async () => {
      const waiting = await load();
      if (!cancelled && waiting && polls.current++ < MAX_POLLS) timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [reportId, load]);

  const readAgain = async () => {
    try {
      await recordsApi.reextract(reportId);
      wasWaiting.current = true;
      polls.current = 0;
      const tick = async () => {
        if ((await load()) && polls.current++ < MAX_POLLS) setTimeout(tick, POLL_MS);
      };
      tick();
    } catch (e) {
      setError(await recordErrorMessage(e));
    }
  };

  const startEditing = () => {
    setDraft(data?.text || '');
    setSaveError(null);
    setEditing(true);
    setOpen(true);
  };

  const saveCorrection = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const d = await recordsApi.correctText(reportId, draft);
      setData((prev) => (prev ? { ...prev, text: d.text, extraction: d.extraction } : prev));
      setEditing(false);
      onReady.current?.();
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="text-[11px] text-slate-500">{error}</p>;
  if (!data) return null;

  const ex = data.extraction;
  const waiting = ex.status === 'pending' || ex.status === 'processing';
  const scanned = ex.method === 'ocr' || ex.method === 'pdf-text+ocr';
  const lowConfidence = !ex.corrected && (Boolean(ex.cleanedPhoto) || (typeof ex.confidence === 'number' && ex.confidence < TRUSTED_CONFIDENCE));
  const unsure = ex.corrected ? [] : ex.uncertainNumbers || [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          {waiting ? (
            <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
          ) : ex.method === 'ocr' || ex.method === 'pdf-text+ocr' ? (
            <ScanText className="w-3.5 h-3.5 text-blue-600" />
          ) : (
            <FileSearch className="w-3.5 h-3.5 text-blue-600" />
          )}
          {waiting
            ? 'Reading the text in this file… scanned pages take a few seconds each'
            : ex.status === 'failed'
              ? 'The text in this file could not be read'
              : METHOD_LABEL[ex.method || ''] || 'Text from the file'}
        </div>
        {!waiting && (
          <div className="flex items-center gap-3">
            {data.text && (
              <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-0.5 font-bold text-blue-600 hover:text-blue-800">
                {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {open ? 'Hide text' : 'Show text'}
              </button>
            )}
            {scanned && ex.status === 'done' && !editing && (
              <button type="button" onClick={startEditing} className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800" title="Fix words or numbers the scan got wrong">
                <PencilLine className="w-3 h-3" /> Correct the text
              </button>
            )}
            {ex.status !== 'unsupported' && (
              <button type="button" onClick={readAgain} className="inline-flex items-center gap-1 font-bold text-slate-500 hover:text-slate-800" title="Read the file again">
                <RefreshCw className="w-3 h-3" /> Read again
              </button>
            )}
          </div>
        )}
      </div>

      {!waiting && ex.status === 'done' && (
        <p className="text-slate-500">
          {[
            ex.pages ? `${ex.pages} page${ex.pages === 1 ? '' : 's'}` : '',
            ex.ocrPages ? `${ex.ocrPages} scanned pages read` : '',
            typeof ex.confidence === 'number' ? `${ex.confidence}% sure of the scanned text` : '',
            ex.chars ? `${ex.chars.toLocaleString()} characters` : ''
          ]
            .filter(Boolean)
            .join(' · ')}
          {data.text ? '' : ex.method === 'plain' ? ' — same as the typed notes' : ' — no text found'}
        </p>
      )}

      {ex.corrected && (
        <p className="flex items-start gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {`This text was checked and corrected by a person${ex.correctedAt ? ` on ${new Date(ex.correctedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}. The original file is unchanged.`}
        </p>
      )}
      {lowConfidence && (
        <p className="flex items-start gap-1.5 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            The scan was hard to read, so some values may be wrong, and to protect your privacy only the built-in checker is used.{' '}
            <button type="button" onClick={startEditing} className="font-bold underline">
              Check and correct the text
            </button>{' '}
            against the original file to use the full assistant.
          </span>
        </p>
      )}
      {unsure.length > 0 && (
        <p className="flex items-start gap-1.5 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {`${unsure.length === 1 ? 'One number was' : `${unsure.length} numbers were`} hard to read: ${unsure.slice(0, 8).join(', ')}${unsure.length > 8 ? ' …' : ''}. Check ${unsure.length === 1 ? 'it' : 'them'} against the original file.`}
        </p>
      )}
      {ex.status === 'failed' && ex.error && <p className="text-rose-700">{ex.error}</p>}
      {(ex.warnings || []).filter((w) => w !== 'Same as the notes.').map((w) => (
        <p key={w} className="text-amber-700">
          {w}
        </p>
      ))}

      {editing && (
        <div className="space-y-2">
          <label htmlFor={`fix-${reportId}`} className="block font-bold text-slate-700">
            Correct the text — compare it with the original file, then save
          </label>
          <textarea
            id={`fix-${reportId}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            className="w-full font-mono text-[11px] leading-relaxed bg-white border border-slate-300 rounded-xl p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {saveError && <p className="text-rose-700">{saveError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveCorrection}
              disabled={saving || !draft.trim()}
              className="min-h-[44px] px-4 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save corrected text'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="min-h-[44px] px-4 rounded-xl border border-slate-300 font-bold text-slate-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {open && !editing && data.text && (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed bg-white border border-slate-200 rounded-xl p-3 text-slate-800">
          {data.text}
        </pre>
      )}
    </div>
  );
};
