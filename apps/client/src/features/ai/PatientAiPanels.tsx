import { formatDayMonth, formatTime } from '../../lib/format.js';
import { formatDate } from '../../lib/format.js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { prescriptionsApi, Prescription } from '../../api/prescriptionsApi.js';
import { aiApi } from '../../api/aiApi.js';
import { AiSummaryResponse, DrugInfoResponse, DrugInteractionResponse, MedicalRecord, TrendsResponse, TrendSeries, VitalReading, VitalType } from '../../types/index.js';
import { vitalsApi } from '../../api/vitalsApi.js';
import { HealthTrendChart, MarkerLegend, SERIES_COLORS, originLabel, statusLabel } from './HealthTrendChart.js';
import { AbnormalValuesTable, DrugAlertsList, EngineBadge, aiErrorMessage } from './AiResultBlocks.js';
import { PrivacyPreview } from './PrivacyPreview.js';
import { FileTextPanel } from './FileTextPanel.js';
import { Activity, ChevronRight, FileText, Pill, Plus, Search, Sparkles, Stethoscope, Trash2, TrendingUp, Upload } from 'lucide-react';

const Spinner: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-2 py-10 justify-center text-slate-500 text-sm">
    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    {label}
  </div>
);

const ErrorBox: React.FC<{ message: string }> = ({ message }) => (
  <div role="alert" className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
    {message}
  </div>
);

const recordDate = (r: MedicalRecord): string => {
  const d = r.createdAt ? new Date(r.createdAt) : new Date(Number(r.reportId));
  return Number.isNaN(d.getTime()) ? '' : formatDate(d);
};

// ---------------------------------------------------------------------------
// Trends (Guide §6.4)
// ---------------------------------------------------------------------------

type Range = '3m' | '6m' | '1y' | 'all';
const RANGE_DAYS: Record<Range, number | null> = { '3m': 92, '6m': 183, '1y': 366, all: null };
const RANGE_LABEL: Record<Range, string> = { '3m': '3 months', '6m': '6 months', '1y': '1 year', all: 'All time' };

const VITAL_FORM: Record<VitalType, { label: string; unit: string; units?: string[]; placeholder: string; pair?: boolean }> = {
  bp: { label: 'Blood pressure', unit: 'mmHg', placeholder: '120', pair: true },
  heart_rate: { label: 'Heart rate', unit: 'bpm', placeholder: '72' },
  spo2: { label: 'Oxygen (SpO2)', unit: '%', placeholder: '98' },
  fasting_glucose: { label: 'Fasting sugar', unit: 'mg/dL', placeholder: '95' },
  random_glucose: { label: 'Sugar (random / after meal)', unit: 'mg/dL', placeholder: '130' },
  temperature: { label: 'Temperature', unit: '°C', units: ['C', 'F'], placeholder: '37.0' },
  weight: { label: 'Weight', unit: 'kg', units: ['kg', 'lb'], placeholder: '70' }
};

const statusChip = (status: 'normal' | 'low' | 'high') =>
  status === 'normal'
    ? { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: '✓ In range' }
    : { cls: 'bg-rose-50 text-rose-700 border-rose-200', text: status === 'high' ? '▲ Above range' : '▼ Below range' };

const shortLabel = (s: TrendSeries) => (s.key === 'systolic_bp' ? 'Blood Pressure' : s.label);
const localNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/** Adds a home reading. Readings appear in the charts straight away. */
const AddReadingForm: React.FC<{ onSaved: () => void; onCancel: () => void }> = ({ onSaved, onCancel }) => {
  const [type, setType] = useState<VitalType>('bp');
  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');
  const [unit, setUnit] = useState('');
  const [takenAt, setTakenAt] = useState(localNow());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spec = VITAL_FORM[type];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await vitalsApi.add({
        type,
        value: Number(value),
        value2: spec.pair ? Number(value2) : undefined,
        unit: spec.units ? unit || spec.units[0] : undefined,
        takenAt: new Date(takenAt).toISOString(),
        note: note.trim() || undefined
      });
      onSaved();
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full text-sm p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500';
  return (
    <form onSubmit={submit} className="bg-white rounded-3xl p-5 border border-blue-200 shadow-xs space-y-3">
      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <Plus className="w-4 h-4 text-blue-600" /> Add a reading
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="text-xs font-semibold text-slate-600 space-y-1">
          <span>Measurement</span>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as VitalType);
              setUnit('');
            }}
            className={input}
          >
            {(Object.keys(VITAL_FORM) as VitalType[]).map((t) => (
              <option key={t} value={t}>
                {VITAL_FORM[t].label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 space-y-1">
          <span>{spec.pair ? 'Reading (upper / lower)' : `Value (${spec.units ? unit || spec.units[0] : spec.unit})`}</span>
          <div className="flex items-center gap-1.5">
            <input required inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={spec.placeholder} className={input} aria-label={spec.pair ? 'Systolic (upper number)' : spec.label} />
            {spec.pair && (
              <>
                <span className="text-slate-400">/</span>
                <input required inputMode="decimal" value={value2} onChange={(e) => setValue2(e.target.value)} placeholder="80" className={input} aria-label="Diastolic (lower number)" />
              </>
            )}
            {spec.units && (
              <select value={unit || spec.units[0]} onChange={(e) => setUnit(e.target.value)} className={`${input} w-20`} aria-label="Unit">
                {spec.units.map((u) => (
                  <option key={u} value={u}>
                    {u === 'C' ? '°C' : u === 'F' ? '°F' : u}
                  </option>
                ))}
              </select>
            )}
          </div>
        </label>
        <label className="text-xs font-semibold text-slate-600 space-y-1">
          <span>When</span>
          <input type="datetime-local" required max={localNow()} value={takenAt} onChange={(e) => setTakenAt(e.target.value)} className={input} />
        </label>
        <label className="text-xs font-semibold text-slate-600 space-y-1">
          <span>Note (optional)</span>
          <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. after breakfast" className={input} />
        </label>
      </div>
      {error && <ErrorBox message={error} />}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-2">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-4 py-2 rounded-xl">
          {saving ? 'Saving…' : 'Save reading'}
        </button>
      </div>
    </form>
  );
};

const TrendTable: React.FC<{ series: TrendSeries; companion?: TrendSeries }> = ({ series, companion }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-64">
    <table className="w-full text-xs">
      <thead className="bg-slate-50 text-slate-500 text-left sticky top-0">
        <tr>
          <th className="p-2 font-semibold">Date</th>
          <th className="p-2 font-semibold">Value</th>
          <th className="p-2 font-semibold">Status</th>
          <th className="p-2 font-semibold">Source</th>
        </tr>
      </thead>
      <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
        {[...series.points].reverse().map((p, i) => {
          const d = companion?.points.find((q) => q.date === p.date && q.origin === p.origin);
          const worst = d && d.status !== 'normal' ? d.status : p.status;
          return (
            <tr key={i} className="border-t border-slate-100">
              <td className="p-2 whitespace-nowrap">{formatDate(p.date)}</td>
              <td className="p-2 font-bold text-slate-900 whitespace-nowrap">
                {p.value}
                {d ? `/${d.value}` : ''} <span className="font-normal text-slate-400">{series.unit}</span>
              </td>
              <td className="p-2 whitespace-nowrap">{statusLabel(worst)}</td>
              <td className="p-2 text-slate-500">{p.origin === 'report' || !p.origin ? p.source || 'Report' : originLabel(p.origin)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

/** Latest blood pressure, heart rate, oxygen and sugar for the dashboard home — from real data. */
export const LatestVitalsStrip: React.FC<{ onAdd?: () => void }> = ({ onAdd }) => {
  const [series, setSeries] = useState<TrendSeries[] | null>(null);
  useEffect(() => {
    aiApi
      .trends()
      .then((d) => setSeries(d.series))
      .catch(() => setSeries([]));
  }, []);
  const find = (k: string) => series?.find((s) => s.key === k && s.points.length);
  const sugar = (() => {
    const f = find('fasting_glucose');
    const r = find('random_glucose');
    if (f && r) return new Date(f.points[f.points.length - 1].date) >= new Date(r.points[r.points.length - 1].date) ? f : r;
    return f || r;
  })();
  const tiles: Array<{ label: string; s?: TrendSeries; dia?: TrendSeries }> = [
    { label: 'Blood Pressure', s: find('systolic_bp'), dia: find('diastolic_bp') },
    { label: 'Heart Rate', s: find('heart_rate') },
    { label: 'Blood Oxygen (SpO2)', s: find('spo2') },
    { label: sugar?.key === 'fasting_glucose' ? 'Fasting Sugar' : 'Blood Sugar', s: sugar }
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
      {tiles.map(({ label, s, dia }) => {
        const p = s?.points[s.points.length - 1];
        const d = dia?.points.find((q) => p && q.date === p.date && q.origin === p.origin);
        const status = p ? (d && d.status !== 'normal' ? d.status : p.status) : 'normal';
        const chip = statusChip(status);
        return (
          <div key={label} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1 min-h-[106px]">
            <span className="text-[11px] font-bold text-slate-400 tracking-wider block">{label}</span>
            {series === null ? (
              <div className="h-8 w-24 rounded bg-slate-100 animate-pulse" />
            ) : p ? (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-[#0B1220]">
                    {p.value.toLocaleString()}
                    {d ? ` / ${d.value}` : ''}
                  </span>
                  <span className="text-xs text-[#64748B]">{s!.unit}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border ${chip.cls}`}>{chip.text}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(p.date).getFullYear() !== new Date().getFullYear() ? formatDate(p.date) : formatDayMonth(p.date)}
                  </span>
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <span className="text-2xl font-extrabold text-slate-300 block">—</span>
                {onAdd && (
                  <button type="button" onClick={onAdd} className="text-[11px] font-bold text-blue-600 hover:text-blue-800">
                    + Add a reading
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const PatientHealthTrends: React.FC<{ openAddForm?: boolean }> = ({ openAddForm = false }) => {
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [readings, setReadings] = useState<VitalReading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(openAddForm);
  const [asTable, setAsTable] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const rangeTouched = useRef(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [t, v] = await Promise.all([aiApi.trends(), vitalsApi.list().catch(() => [] as VitalReading[])]);
      setData(t);
      setReadings(v);
      // start on the last year when there is recent data, so an old record does not squash the chart
      setRange((r) => {
        if (r !== 'all' || rangeTouched.current) return r;
        const yearAgo = Date.now() - 366 * 86_400_000;
        const all = t.series.flatMap((x) => x.points.map((p) => new Date(p.date).getTime()));
        return all.some((ms) => ms >= yearAgo) && all.some((ms) => ms < yearAgo) ? '1y' : r;
      });
      setError(null);
    } catch (e) {
      setError(aiErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // the range filter scopes every card and the chart
  const visible = useMemo(() => {
    if (!data) return [];
    const days = RANGE_DAYS[range];
    const from = days ? Date.now() - days * 86_400_000 : -Infinity;
    return data.series
      .map((s) => ({ ...s, points: s.points.filter((p) => new Date(p.date).getTime() >= from) }))
      .filter((s) => s.points.length);
  }, [data, range]);

  const cards = visible.filter((s) => s.key !== 'diastolic_bp');
  const current = cards.find((s) => s.key === selected) || cards[0];
  const companion = current?.key === 'systolic_bp' ? visible.find((s) => s.key === 'diastolic_bp') : undefined;

  const remove = async (id: string) => {
    try {
      await vitalsApi.remove(id);
      await load();
    } catch (e) {
      setError(aiErrorMessage(e));
    }
  };

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Spinner label="Reading your records and readings…" />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* filters: one row, above everything they scope */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Time range" className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          {(Object.keys(RANGE_DAYS) as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                rangeTouched.current = true;
                setRange(r);
              }}
              aria-pressed={range === r}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${range === r ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowForm((f) => !f)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl"
        >
          <Plus className="w-4 h-4" /> Add a reading
        </button>
      </div>

      {showForm && (
        <AddReadingForm
          onCancel={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}
      {error && <ErrorBox message={error} />}

      {cards.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-dashed border-slate-300 text-center text-slate-500 text-sm space-y-2">
          <Upload className="w-8 h-8 mx-auto text-slate-300" />
          <p>
            {data.series.length
              ? `No values in the last ${RANGE_LABEL[range].toLowerCase()}. Choose a longer range or add a reading.`
              : 'No measurements yet. Add a reading (for example your blood pressure or sugar), or upload a lab report — values are read from it automatically.'}
          </p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-5 transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
          {/* measurement cards */}
          <div className="lg:col-span-4 space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
            {cards.map((s) => {
              const last = s.points[s.points.length - 1];
              const dia = s.key === 'systolic_bp' ? visible.find((x) => x.key === 'diastolic_bp') : undefined;
              const d = dia?.points.find((q) => q.date === last.date && q.origin === last.origin);
              const chip = statusChip(d && d.status !== 'normal' ? d.status : last.status);
              const isSel = s.key === current?.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSelected(s.key)}
                  aria-pressed={isSel}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all ${isSel ? 'border-blue-400 bg-blue-50/60 ring-1 ring-blue-300' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{shortLabel(s)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${chip.cls}`}>{chip.text}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 mt-1">
                    <span className="text-xl font-black text-slate-900">
                      {last.value.toLocaleString()}
                      {d ? `/${d.value}` : ''} <span className="text-[11px] font-semibold text-slate-400">{s.unit}</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {s.points.length > 1 ? `${s.points.length} values` : '1 value'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* chart */}
          {current && (
            <div className="lg:col-span-8 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{shortLabel(current)}</h3>
                  <p className="text-[11px] text-slate-500">
                    Normal: {current.key === 'systolic_bp' ? '90–120 / 60–80 mmHg' : current.referenceRange} · {current.note}
                  </p>
                </div>
                <button type="button" onClick={() => setAsTable((t) => !t)} className="text-[11px] font-bold text-blue-600 hover:text-blue-800">
                  {asTable ? 'Show chart' : 'Show as table'}
                </button>
              </div>
              {companion && (
                <div className="flex items-center gap-4 text-[11px] text-slate-600">
                  {['Systolic (upper)', 'Diastolic (lower)'].map((n, i) => (
                    <span key={n} className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-4 h-0.5 rounded" style={{ background: SERIES_COLORS[i] }} aria-hidden="true" />
                      {n}
                    </span>
                  ))}
                </div>
              )}
              {asTable ? <TrendTable series={current} companion={companion} /> : <HealthTrendChart series={current} companion={companion} names={['Systolic', 'Diastolic']} />}
              <MarkerLegend origins={current.points.map((p) => p.origin)} band={current.rangeLow !== undefined || current.rangeHigh !== undefined} />
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-slate-900 tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" /> What the trends show
          </h3>
          <EngineBadge engine={data.engine} notice={data.privacyNotice} />
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{data.narrative}</p>
        <p className="text-[11px] text-slate-500">{data.safetyDisclaimer}</p>
      </div>

      {readings.length > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 tracking-wider">Your recent readings</h3>
          <ul className="divide-y divide-slate-100">
            {readings.slice(0, 12).map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <span className="font-bold text-slate-900">
                    {VITAL_FORM[r.type].label}: {r.value}
                    {r.value2 !== undefined ? `/${r.value2}` : ''} {r.unit}
                  </span>
                  <span className="text-slate-400">
                    {' '}
                    · {formatDayMonth(r.takenAt)}, {formatTime(r.takenAt)}
                    {r.origin === 'clinic' ? ' · entered at clinic' : ''}
                  </span>
                  {r.note && <span className="block text-slate-500 truncate">{r.note}</span>}
                </div>
                {r.origin === 'home' && (
                  <button type="button" onClick={() => remove(r.id)} className="text-slate-400 hover:text-rose-600 shrink-0" aria-label={`Delete ${VITAL_FORM[r.type].label} reading`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Reports explained (Guide §6.2 / 6.3)
// ---------------------------------------------------------------------------

export const PatientReportsExplained: React.FC<{ records: MedicalRecord[]; initialReportId?: string }> = ({ records, initialReportId }) => {
  const sorted = useMemo(
    // example cards shown by the dashboard are not stored on the server, so they cannot be explained
    () => records.filter((r) => !r.isSample).sort((a, b) => Number(b.reportId) - Number(a.reportId)),
    [records]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<AiSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const explain = useCallback(async (reportId: string) => {
    setSelectedId(reportId);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await aiApi.summarize(undefined, undefined, reportId));
    } catch (e) {
      setError(aiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId && sorted.length) {
      const start = sorted.find((r) => r.reportId === initialReportId) || sorted[0];
      explain(start.reportId);
    }
  }, [sorted, selectedId, initialReportId, explain]);

  const selected = sorted.find((r) => r.reportId === selectedId);

  if (!sorted.length) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-dashed border-slate-300 text-center text-slate-500 text-sm">
        <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        You have no reports yet. Upload one from “My Records” and it will be explained here.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
      <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-900 tracking-wider">Select a report</h3>
          <span className="text-[11px] text-slate-400 font-semibold">
            {sorted.length} file{sorted.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="space-y-2 max-h-[520px] overflow-y-auto">
          {sorted.map((r) => {
            const isSelected = selectedId === r.reportId;
            return (
              <button
                key={r.reportId}
                type="button"
                onClick={() => explain(r.reportId)}
                className={`w-full p-3 rounded-2xl text-left transition-all border flex items-center gap-3 ${
                  isSelected ? 'bg-blue-50/80 border-blue-500' : 'bg-white hover:bg-slate-50 border-slate-100'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{r.fileName}</h4>
                  <p className="text-[11px] text-slate-400 truncate">{recordDate(r)}</p>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-300'}`} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-5">
        {selected && (
          <div className="space-y-1 pb-4 border-b border-slate-100">
            <h3 className="text-lg font-extrabold text-slate-900 break-words">{selected.fileName}</h3>
            <p className="text-xs text-slate-400">
              {recordDate(selected)} · fingerprint {selected.fileHash?.slice(0, 12)}…
            </p>
          </div>
        )}
        {selected && !selected.isSample && selected.fileAvailable !== false && (
          <FileTextPanel key={selected.reportId} reportId={selected.reportId} onTextReady={() => explain(selected.reportId)} />
        )}
        {loading && <Spinner label="Explaining this report…" />}
        {error && <ErrorBox message={error} />}
        {result && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <EngineBadge engine={result.engine} notice={result.privacyNotice} redactions={result.deidentification?.redactions} />
              {selectedId && <PrivacyPreview key={selectedId} reportId={selectedId} />}
            </div>
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-1.5">
              <div className="flex items-center gap-2 text-blue-950 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-blue-600" /> What this report means in simple words
              </div>
              <p translate="no" className="text-xs text-blue-900 leading-relaxed">{result.summary}</p>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 tracking-wider">Values outside the normal range</h4>
              <AbnormalValuesTable values={result.abnormalValues} />
            </div>

            {result.labValues.filter((v) => v.status === 'normal' && v.key !== 'diastolic_bp').length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 tracking-wider">Values in the normal range</h4>
                <div className="flex flex-wrap gap-2">
                  {result.labValues
                    .filter((v) => v.status === 'normal' && v.key !== 'diastolic_bp')
                    .map((v) => (
                      <span key={v.key} className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
                        {v.label.replace(' (systolic)', '')}: <strong>{v.display}</strong>
                        {v.uncertain && (
                          <span className="ml-1 font-bold text-amber-800" title="This number was hard to read in the scan">
                            (check against the report)
                          </span>
                        )}
                      </span>
                    ))}
                </div>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-blue-600" /> Questions to ask your doctor
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(result.questionsForDoctor.map((q, i) => `${i + 1}. ${q}`).join('\n')).catch(() => undefined);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800"
                >
                  {copied ? '✓ Copied' : 'Copy questions'}
                </button>
              </div>
              <ol className="space-y-1.5 list-decimal list-inside text-xs text-slate-700">
                {result.questionsForDoctor.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </div>
            <p className="text-[11px] text-slate-500">{result.safetyDisclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Medicines (Guide §6.5)
// ---------------------------------------------------------------------------

export const PatientMedicationsPanel: React.FC<{ records: MedicalRecord[] }> = ({ records }) => {
  const [fromRecords, setFromRecords] = useState<string[] | null>(null);
  const [infos, setInfos] = useState<DrugInfoResponse[]>([]);
  const [check, setCheck] = useState<DrugInteractionResponse | null>(null);
  const [extra, setExtra] = useState('');
  const [allergies, setAllergies] = useState('');
  const [lookup, setLookup] = useState('');
  const [lookupResult, setLookupResult] = useState<DrugInfoResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prescribed, setPrescribed] = useState<Prescription[] | null>(null);

  // Prescriptions written for this patient by doctors they shared records with
  useEffect(() => {
    prescriptionsApi
      .list()
      .then(setPrescribed)
      .catch(() => setPrescribed([]));
  }, []);

  // Medicines named in the patient's own records
  useEffect(() => {
    if (!records.length) {
      setFromRecords([]);
      return;
    }
    aiApi
      .summarize()
      .then(async (s) => {
        setFromRecords(s.medications);
        setInfos(await Promise.all(s.medications.map((m) => aiApi.drugInfo(m))));
      })
      .catch(() => setFromRecords([]));
  }, [records.length]);

  const runCheck = async () => {
    setBusy(true);
    setError(null);
    try {
      const active = (prescribed || []).filter((p) => p.status === 'Active').map((p) => p.drugName);
      const meds = [...new Set([...active, ...(fromRecords || []), ...extra.split(',').map((m) => m.trim()).filter(Boolean)])];
      if (meds.length < 1) throw new Error('Add at least one medicine to check.');
      setCheck(await aiApi.checkDrugs(meds, allergies.split(',').map((a) => a.trim()).filter(Boolean)));
    } catch (e) {
      setError(e instanceof Error && !('response' in e) ? e.message : aiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookup.trim()) return;
    setBusy(true);
    try {
      setLookupResult(await aiApi.drugInfo(lookup.trim()));
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full text-xs p-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Pill className="w-4 h-4 text-blue-600" /> Prescribed by your doctors
        </h3>
        {prescribed === null && <p className="text-xs text-slate-500">Loading…</p>}
        {prescribed && prescribed.length === 0 && (
          <p className="text-xs text-slate-500">No prescriptions yet. When a doctor you share your records with writes one, it appears here.</p>
        )}
        {prescribed && prescribed.length > 0 && (
          <ul className="divide-y divide-slate-100 text-xs">
            {prescribed.map((p) => (
              <li key={p.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-bold text-slate-900">{p.drugName}</span> · {p.dosage} · {p.frequency} · {p.duration}
                  {p.instructions ? <span className="block text-[11px] text-slate-500">{p.instructions}</span> : null}
                </span>
                <span className="text-[11px] text-slate-500">
                  {p.prescriberName} · {formatDate(p.createdAt)} ·{' '}
                  <span className={p.status === 'Active' ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                    {p.status === 'Active' ? 'Taking now' : 'Stopped'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Pill className="w-4 h-4 text-amber-600" /> Medicines found in your records
        </h3>
        {fromRecords === null ? (
          <Spinner label="Looking for medicines in your records…" />
        ) : fromRecords.length === 0 ? (
          <p className="text-xs text-slate-500">No medicine names were found in your uploaded records.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {infos.map((d) => (
              <div key={d.name} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                <h4 className="text-sm font-bold text-slate-900">{d.name}</h4>
                <p className="text-slate-700">{d.purpose}</p>
                {d.commonSideEffects.length > 0 && (
                  <p className="text-slate-600">
                    <strong>Common side effects:</strong> {d.commonSideEffects.join(', ')}
                  </p>
                )}
                {d.precautions.length > 0 && (
                  <p className="text-slate-600">
                    <strong>Good to know:</strong> {d.precautions.join(' ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-600" /> Check medicines together
          </h3>
          <p className="text-xs text-slate-500">
            Checks your recorded medicines{fromRecords?.length ? ` (${fromRecords.join(', ')})` : ''} plus any others you add — including
            over-the-counter ones.
          </p>
          <input className={input} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Other medicines, e.g. Ibuprofen, Dolo 650" aria-label="Other medicines" />
          <input className={input} value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Allergies, e.g. Penicillin" aria-label="Allergies" />
          <button
            type="button"
            onClick={runCheck}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
          >
            Check for interactions
          </button>
          {error && <ErrorBox message={error} />}
          {check && <DrugAlertsList data={check} audience="patient" />}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-600" /> Look up a medicine
          </h3>
          <form onSubmit={runLookup} className="flex gap-2">
            <input className={input} value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="e.g. Metformin, Pan 40, Augmentin" aria-label="Medicine name" />
            <button type="submit" disabled={busy} className="px-4 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50">
              Explain
            </button>
          </form>
          {lookupResult && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-900">{lookupResult.name}</h4>
                <EngineBadge engine={lookupResult.engine} notice={lookupResult.privacyNotice} />
              </div>
              <p className="text-slate-700">{lookupResult.purpose}</p>
              {lookupResult.commonSideEffects.length > 0 && (
                <p className="text-slate-600">
                  <strong>Common side effects:</strong> {lookupResult.commonSideEffects.join(', ')}
                </p>
              )}
              {lookupResult.precautions.length > 0 && (
                <p className="text-slate-600">
                  <strong>Good to know:</strong> {lookupResult.precautions.join(' ')}
                </p>
              )}
              <p className="text-[11px] text-slate-500">{lookupResult.safetyDisclaimer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
