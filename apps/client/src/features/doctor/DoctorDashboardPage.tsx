import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, Download, FileText, History, KeyRound, Pill, Send, Sparkles, Stethoscope, UploadCloud, Users, Activity } from 'lucide-react';
import { ActiveSessionsCard } from '../../components/common/ActiveSessionsCard.js';
import { ChangePasswordCard } from '../../components/common/ChangePasswordCard.js';
import { WalletCard } from '../../components/common/WalletCard.js';
import { LiveActivityTimeline } from '../../components/common/LiveActivityTimeline.js';
import { ProfileSettingsCard } from '../../components/common/ProfileSettingsCard.js';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Dropzone } from '../../components/common/Dropzone.js';
import { Field, NoticeBar, Notice, PageHeader, SearchBox, SelectField, SimpleTable, StatCard, StatusBadge } from '../../components/common/PageKit.js';
import { AiHealthAssistant } from '../ai/AiHealthAssistant.js';
import { useAuthStore } from '../../store/authStore.js';
import { useUIStore } from '../../store/uiStore.js';
import { authApi } from '../../api/authApi.js';
import { recordsApi, recordErrorMessage } from '../../api/recordsApi.js';
import { consentApi, summaryApi } from '../../api/consentApi.js';
import { vitalsApi } from '../../api/vitalsApi.js';
import { aiApi } from '../../api/aiApi.js';
import { prescriptionsApi, Prescription } from '../../api/prescriptionsApi.js';
import { MedicalRecord, Patient, VitalReading } from '../../types/index.js';
import { errorText, formatAgo, formatDate } from '../../lib/format.js';

type Access = 'GRANTED' | 'PENDING' | 'NO_REQUEST';

const titleCase = (s?: string) => (s || '').replace(/\b\w/g, (c) => c.toUpperCase());

const ACCESS_LABEL: Record<Access, string> = { GRANTED: 'Shared', PENDING: 'Waiting', NO_REQUEST: 'Not shared' };
const ACCESS_TONE: Record<Access, string> = { GRANTED: 'Active', PENDING: 'Needs information', NO_REQUEST: 'Off duty' };

const VITAL_LABEL: Record<string, string> = {
  bp: 'Blood pressure',
  heart_rate: 'Heart rate',
  spo2: 'Oxygen',
  temperature: 'Temperature',
  weight: 'Weight',
  fasting_glucose: 'Fasting sugar',
  random_glucose: 'Blood sugar'
};

const TITLES: Record<string, string> = {'dashboard': 'Overview', 'patients': 'My patients', 'records': 'Reports', 'requests': 'Record requests', 'ai': 'AI assistant', 'medications': 'Prescriptions', 'activity': 'Activity', 'settings': 'Settings'};

const SUBTITLES: Record<string, string> = {
  dashboard: 'Your patients, what they have shared with you, and what needs attention.',
  patients: 'Registered patients and whether they have shared their records with you.',
  records: 'Reports from patients who have shared their records with you.',
  requests: 'Ask a patient to share their records, and see who has answered.',
  ai: 'Summaries, lab explanations and medicine checks for a patient who shared their records.',
  medications: 'Write prescriptions and see the ones you have written.',
  activity: 'Everything done with this account, newest first.',
  settings: 'Your password, sessions and practice details.'
};

export const DoctorDashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { openActivityModal } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.toLowerCase();
  const view =
    (['patients', 'records', 'requests', 'ai', 'medications', 'activity', 'settings'] as const).find((v) => path.includes(`/${v}`)) || 'dashboard';
  const doctorId = String(user?.userId || '');

  const [notice, setNotice] = useState<Notice>(null);
  const say = (text: string, ok = true) => setNotice({ text, tone: ok ? 'ok' : 'error' });

  const [patients, setPatients] = useState<Patient[]>([]);
  const [access, setAccess] = useState<Record<string, Access>>({});
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [meds, setMeds] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');

  const [summary, setSummary] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  /** One call: every patient this doctor has asked, or who shares with them. */
  const refreshAccess = async () => {
    const map: Record<string, Access> = {};
    try {
      const overview = await consentApi.status();
      const why: Record<string, string> = {};
      for (const e of overview.entries) {
        map[e.patientId] = e.status === 'granted' ? 'GRANTED' : e.status === 'pending' ? 'PENDING' : 'NO_REQUEST';
        if (e.reason) why[e.patientId] = e.reason;
      }
      setReasons(why);
    } catch {
      /* keep what we had */
    }
    setAccess(map);
    summaryApi.get().then(setSummary).catch(() => undefined);
    return map;
  };

  const load = async () => {
    setLoading(true);
    const [p, r, m] = await Promise.allSettled([authApi.getPatients(), recordsApi.getRecords({ summary: true }), prescriptionsApi.list()]);
    const list = p.status === 'fulfilled' ? p.value.map((x) => ({ ...x, name: titleCase(x.name) })) : [];
    setPatients(list);
    if (r.status === 'fulfilled') setRecords(r.value);
    if (m.status === 'fulfilled') setMeds(m.value);
    if (p.status === 'rejected') say('The patient list could not be loaded. Please reload the page.', false);
    const map = await refreshAccess();
    setSelectedId((cur) => cur || list.find((x) => map[x.patientId] === 'GRANTED')?.patientId || list[0]?.patientId || '');
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const granted = patients.filter((p) => access[p.patientId] === 'GRANTED');
  const pending = patients.filter((p) => access[p.patientId] === 'PENDING');
  const grantedIds = useMemo(() => new Set(granted.map((p) => p.patientId)), [granted]);
  const visibleRecords = records.filter((r) => grantedIds.has(r.patientId));
  const selected = patients.find((p) => p.patientId === selectedId) || null;
  const selectedAccess: Access = selected ? access[selected.patientId] || 'NO_REQUEST' : 'NO_REQUEST';
  const nameOf = (id: string) => patients.find((p) => p.patientId === id)?.name || `Patient ${id}`;

  // ---------- ask for access ----------
  const [asking, setAsking] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const ask = async (patientId: string) => {
    setAsking(true);
    try {
      await consentApi.request(patientId, requestReason.trim() || undefined);
      await refreshAccess();
      setRequestReason('');
      say(`Request sent to ${nameOf(patientId)}. They will see it on their dashboard and can accept or decline.`);
    } catch (err) {
      say(errorText(err, 'The request could not be sent. Please try again.'), false);
    } finally {
      setAsking(false);
    }
  };

  // ---------- selected patient's readings ----------
  const [readings, setReadings] = useState<VitalReading[] | null>(null);
  useEffect(() => {
    setReadings(null);
    if (!selected || selectedAccess !== 'GRANTED') return;
    vitalsApi
      .list(selected.patientId)
      .then(setReadings)
      .catch(() => setReadings([]));
  }, [selectedId, selectedAccess]);

  const latestByType = useMemo(() => {
    const out: VitalReading[] = [];
    for (const r of readings || []) if (!out.some((o) => o.type === r.type)) out.push(r);
    return out.slice(0, 4);
  }, [readings]);

  // ---------- workspace tabs ----------
  const [tab, setTab] = useState<'overview' | 'reports' | 'medicines' | 'note'>('overview');
  const patientRecords = selected ? visibleRecords.filter((r) => r.patientId === selected.patientId) : [];
  const patientMeds = selected ? meds.filter((m) => m.patientId === selected.patientId) : [];

  // consultation note
  const [note, setNote] = useState({ title: 'Consultation note', text: '' });
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const saveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!note.text.trim() && !noteFile) {
      say('Write the note or attach a file first.', false);
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      if (noteFile) form.append('file', noteFile);
      form.append('patientId', selected.patientId);
      form.append('clinicalNotes', note.text);
      form.append('reportTitle', note.title || 'Consultation note');
      await recordsApi.uploadRecord(form);
      say(`Note saved to ${selected.name}’s record.`);
      setNote({ title: 'Consultation note', text: '' });
      setNoteFile(null);
      recordsApi.getRecords({ summary: true }).then(setRecords).catch(() => undefined);
    } catch (err) {
      say(await recordErrorMessage(err), false);
    } finally {
      setSaving(false);
    }
  };

  // ---------- prescriptions ----------
  const blankRx = { patientId: '', drugName: '', dosage: '', frequency: 'Once daily', duration: '7 days', instructions: '' };
  const [rx, setRx] = useState(blankRx);
  const [rxWarning, setRxWarning] = useState<string | null>(null);
  const writeRx = async (e: React.FormEvent) => {
    e.preventDefault();
    const pid = rx.patientId || selectedId;
    setSaving(true);
    setRxWarning(null);
    try {
      const current = meds.filter((m) => m.patientId === pid && m.status === 'Active').map((m) => m.drugName);
      if (current.length) {
        const check = await aiApi.checkDrugs([...current, rx.drugName]).catch(() => null);
        const serious = check?.alerts.filter((a) => a.severity !== 'low') || [];
        if (serious.length) setRxWarning(serious.map((a) => `${a.drugs.join(' + ')}: ${a.description}`).join(' '));
      }
      const created = await prescriptionsApi.create({ ...rx, patientId: pid, instructions: rx.instructions || undefined });
      setMeds((prev) => [created, ...prev]);
      setRx({ ...blankRx, patientId: pid });
      say(`Prescription for ${created.drugName} saved to ${nameOf(pid)}’s record.`);
    } catch (err) {
      say(errorText(err, 'The prescription could not be saved.'), false);
    } finally {
      setSaving(false);
    }
  };
  const stopRx = async (m: Prescription) => {
    try {
      const updated = await prescriptionsApi.setStatus(m.id, 'Stopped');
      setMeds((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
      say(`${m.drugName} stopped.`);
    } catch (err) {
      say(errorText(err, 'The change could not be saved.'), false);
    }
  };

  // ---------- lists ----------
  const [search, setSearch] = useState('');
  const shownPatients = patients.filter((p) => !search || [p.name, p.email, p.patientId].some((v) => (v || '').toLowerCase().includes(search.toLowerCase())));
  const shownRecords = visibleRecords.filter(
    (r) => !search || [r.fileName, r.description, nameOf(r.patientId)].some((v) => (v || '').toLowerCase().includes(search.toLowerCase()))
  );
  const [requestPatient, setRequestPatient] = useState('');

  const downloadBtn = (r: MedicalRecord) => (
    <Button
      variant="outline"
      size="sm"
      className="text-xs px-2.5 py-1"
      onClick={() => recordsApi.downloadRecord(r.reportId, r.fileName).catch((err: Error) => say(err.message, false))}
    >
      <Download className="w-3.5 h-3.5 mr-1" />
      Download
    </Button>
  );

  const rxForm = (fixedPatient?: string) => (
    <form onSubmit={writeRx} className="space-y-4 text-xs">
      {!fixedPatient && (
        <div>
          <label htmlFor="rx-patient" className="block text-xs font-bold text-slate-700 mb-1">
            Patient <span className="text-rose-600">*</span>
          </label>
          <select
            id="rx-patient"
            required
            value={rx.patientId}
            onChange={(e) => setRx({ ...rx, patientId: e.target.value })}
            className="w-full text-xs p-2.5 border border-slate-300 rounded-xl"
          >
            <option value="">Choose a patient who shared their records…</option>
            {granted.map((p) => (
              <option key={p.patientId} value={p.patientId}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Medicine" required placeholder="e.g. Metformin" value={rx.drugName} onChange={(v) => setRx({ ...rx, drugName: v })} />
        <Field label="Dose" required placeholder="e.g. 500 mg" value={rx.dosage} onChange={(v) => setRx({ ...rx, dosage: v })} />
        <SelectField
          label="How often"
          value={rx.frequency}
          onChange={(v) => setRx({ ...rx, frequency: v })}
          options={['Once daily', 'Twice daily', 'Three times daily', 'Every 8 hours', 'At bedtime', 'When needed']}
        />
        <SelectField label="For how long" value={rx.duration} onChange={(v) => setRx({ ...rx, duration: v })} options={['3 days', '5 days', '7 days', '14 days', '30 days', '90 days', 'Ongoing']} />
      </div>
      <Field label="Instructions for the patient" placeholder="e.g. Take after food" value={rx.instructions} onChange={(v) => setRx({ ...rx, instructions: v })} />
      {rxWarning && (
        <p role="alert" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
          Check before giving: {rxWarning}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" disabled={saving || (!fixedPatient && !rx.patientId)}>
          <Pill className="w-3.5 h-3.5 mr-1" />
          {saving ? 'Saving…' : 'Save prescription'}
        </Button>
      </div>
    </form>
  );

  const medsTable = (list: Prescription[], showPatient: boolean) => (
    <SimpleTable
      headers={[...(showPatient ? ['Patient'] : []), 'Medicine', 'How to take', 'Written', 'Status', '']}
      count={list.length}
      empty="No prescriptions yet. Prescriptions you write appear here and in the patient’s record."
    >
      {list.map((m) => (
        <tr key={m.id} className="hover:bg-slate-50/60">
          {showPatient && <td className="py-3 px-4 font-bold text-slate-900">{titleCase(m.patientName) || nameOf(m.patientId)}</td>}
          <td className="py-3 px-4 font-bold text-slate-900">{m.drugName}</td>
          <td className="py-3 px-4 text-slate-600">
            {m.dosage}, {m.frequency.toLowerCase()}, {m.duration}
            {m.instructions && <span className="block text-[11px] text-slate-400">{m.instructions}</span>}
          </td>
          <td className="py-3 px-4 text-slate-500">{formatDate(m.createdAt)}</td>
          <td className="py-3 px-4">
            <StatusBadge status={m.status === 'Active' ? 'Active' : 'Lapsed'} label={m.status === 'Active' ? 'Taking now' : 'Stopped'} />
          </td>
          <td className="py-3 px-4 text-right">
            {m.status === 'Active' && m.prescribedBy === doctorId && (
              <Button variant="ghost" size="sm" className="text-xs px-2 py-1" onClick={() => stopRx(m)}>
                Stop
              </Button>
            )}
          </td>
        </tr>
      ))}
    </SimpleTable>
  );

  return (
    <div className="space-y-6 pb-12">
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />

      <PageHeader
        tag={titleCase(user?.name) || 'Doctor'}
        title={TITLES[view]}
        subtitle={SUBTITLES[view]}
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => navigate('/doctor/requests')} className="text-xs font-bold flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Ask to see records</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/doctor/ai')} className="text-xs font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI assistant</span>
            </Button>
          </>
        }
      />

      {view === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Patients sharing with you" value={loading ? '…' : summary.patientsSharing ?? granted.length} note={`of ${patients.length} registered`} icon={<Users className="w-4 h-4" />} onClick={() => navigate('/doctor/patients')} />
            <StatCard label="Waiting for patients" value={loading ? '…' : summary.waitingForPatients ?? pending.length} note="Requests not answered yet" icon={<Clock className="w-4 h-4" />} onClick={() => navigate('/doctor/requests')} />
            <StatCard label="Reports you can open" value={loading ? '…' : summary.records ?? visibleRecords.length} note="From patients sharing with you" icon={<FileText className="w-4 h-4" />} onClick={() => navigate('/doctor/records')} />
            <StatCard label="Active prescriptions" value={loading ? '…' : summary.activePrescriptions ?? 0} note="Written by you" icon={<Pill className="w-4 h-4" />} onClick={() => navigate('/doctor/medications')} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <Card className="lg:col-span-4 p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Patients</h3>
              {patients.length === 0 && !loading && <p className="text-xs text-slate-500">No patients are registered yet. Patients appear here once they create an account.</p>}
              <ul className="space-y-1.5">
                {patients.map((p) => {
                  const a = access[p.patientId] || 'NO_REQUEST';
                  return (
                    <li key={p.patientId}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(p.patientId);
                          setTab('overview');
                        }}
                        aria-current={p.patientId === selectedId}
                        className={`w-full text-left p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                          p.patientId === selectedId ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-bold text-slate-900">{p.name}</span>
                        <StatusBadge status={ACCESS_TONE[a]} label={ACCESS_LABEL[a]} />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-slate-500">
                Shared = you can open their records. Waiting = you asked and they have not answered yet.
              </p>
            </Card>

            <Card className="lg:col-span-8 p-6 space-y-5">
              {!selected ? (
                <p className="text-xs text-slate-500">Choose a patient on the left.</p>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                        <Stethoscope className="w-5 h-5 text-blue-600" />
                        {selected.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {[selected.age && `${selected.age} years`, selected.email].filter(Boolean).join(' · ')} · {selectedAccess === 'GRANTED' ? 'Shared their records with you' : selectedAccess === 'PENDING' ? 'Waiting for their answer' : 'Has not shared their records'}
                      </p>
                    </div>
                    {selectedAccess === 'GRANTED' && (
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start" role="tablist">
                        {(
                          [
                            ['overview', 'Overview'],
                            ['reports', `Reports (${patientRecords.length})`],
                            ['medicines', `Medicines (${patientMeds.length})`],
                            ['note', 'Write a note']
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={tab === id}
                            onClick={() => setTab(id)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg ${tab === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedAccess !== 'GRANTED' ? (
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-3">
                      <p className="text-slate-700">
                        {selectedAccess === 'PENDING'
                          ? `You asked ${selected.name} to share their records. You can see them once they accept.`
                          : `${selected.name} has not shared their records with you. Ask them first — they decide.`}
                      </p>
                      {selectedAccess === 'NO_REQUEST' && (
                        <Button variant="primary" size="sm" disabled={asking} onClick={() => ask(selected.patientId)}>
                          <Send className="w-3.5 h-3.5 mr-1" />
                          Ask to see records
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      {tab === 'overview' && (
                        <div className="space-y-5">
                          <div>
                            <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5" /> Latest readings
                            </h4>
                            {readings === null ? (
                              <p className="text-xs text-slate-400">Loading…</p>
                            ) : latestByType.length === 0 ? (
                              <p className="text-xs text-slate-500">No blood pressure, sugar or other readings recorded yet.</p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {latestByType.map((r) => (
                                  <div key={r.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                                    <span className="text-[11px] font-bold text-slate-500 block">{VITAL_LABEL[r.type] || r.type}</span>
                                    <span className="text-base font-black text-slate-900 block">
                                      {r.type === 'bp' ? `${r.value}/${r.value2}` : r.value} <span className="text-[11px] font-medium text-slate-500">{r.unit}</span>
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {formatAgo(r.takenAt)} · {r.origin === 'home' ? 'at home' : 'at clinic'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-700 mb-2">Recent reports</h4>
                            {patientRecords.length === 0 ? (
                              <p className="text-xs text-slate-500">No reports yet. Add a note or ask the patient to upload one.</p>
                            ) : (
                              <ul className="divide-y divide-slate-100 text-xs">
                                {patientRecords.slice(0, 3).map((r) => (
                                  <li key={r.reportId} className="py-2 flex items-center justify-between gap-2">
                                    <span>
                                      <span className="font-bold text-slate-900">{r.description || r.fileName}</span>
                                      <span className="text-slate-400"> · {formatDate(r.createdAt)}</span>
                                    </span>
                                    {downloadBtn(r)}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="primary" onClick={() => navigate('/doctor/ai')}>
                              <Sparkles className="w-3.5 h-3.5 mr-1" />
                              Summarise with AI
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setTab('note')}>
                              Write a note
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setTab('medicines')}>
                              Prescribe
                            </Button>
                          </div>
                        </div>
                      )}

                      {tab === 'reports' && (
                        <ul className="divide-y divide-slate-100 text-xs">
                          {patientRecords.length === 0 && <li className="py-3 text-slate-500">No reports yet.</li>}
                          {patientRecords.map((r) => (
                            <li key={r.reportId} className="py-2.5 flex items-center justify-between gap-2">
                              <span>
                                <span className="font-bold text-slate-900 block">{r.description || r.fileName}</span>
                                <span className="text-slate-400">
                                  {formatDate(r.createdAt)} · report {r.reportId}
                                </span>
                              </span>
                              {downloadBtn(r)}
                            </li>
                          ))}
                        </ul>
                      )}

                      {tab === 'medicines' && (
                        <div className="space-y-5">
                          {medsTable(patientMeds, false)}
                          <div className="pt-4 border-t border-slate-100">
                            <h4 className="text-xs font-bold text-slate-700 mb-3">Write a prescription for {selected.name}</h4>
                            {rxForm(selected.patientId)}
                          </div>
                        </div>
                      )}

                      {tab === 'note' && (
                        <form onSubmit={saveNote} className="space-y-4 text-xs">
                          <Field label="Title" value={note.title} onChange={(v) => setNote({ ...note, title: v })} />
                          <div>
                            <label htmlFor="note-text" className="block text-xs font-bold text-slate-700 mb-1">
                              Note
                            </label>
                            <textarea
                              id="note-text"
                              rows={6}
                              value={note.text}
                              placeholder="Findings, diagnosis and plan"
                              onChange={(e) => setNote({ ...note, text: e.target.value })}
                              className="w-full text-xs p-3 border border-slate-300 rounded-xl"
                            />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-slate-700 mb-1">Attach a file (optional)</span>
                            <Dropzone onFileSelect={setNoteFile} accept=".pdf,.docx,.png,.jpg,.jpeg" label="Drop a PDF, Word file or photo" />
                            {noteFile && <p className="mt-1 text-emerald-700 font-bold">Selected: {noteFile.name}</p>}
                          </div>
                          <div className="flex justify-end">
                            <Button type="submit" variant="primary" size="sm" disabled={saving}>
                              <UploadCloud className="w-3.5 h-3.5 mr-1" />
                              {saving ? 'Saving…' : 'Save to patient record'}
                            </Button>
                          </div>
                        </form>
                      )}
                    </>
                  )}
                </>
              )}
            </Card>
          </div>
        </div>
      )}

      {view === 'patients' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <SearchBox value={search} onChange={setSearch} placeholder="Search by name or email" />
          </div>
          <SimpleTable headers={['Patient', 'Email', 'Records', '']} count={shownPatients.length} empty="No patients match your search. Try a shorter name, or clear the search.">
            {shownPatients.map((p) => {
              const a = access[p.patientId] || 'NO_REQUEST';
              return (
                <tr key={p.patientId} className="hover:bg-slate-50/60">
                  <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                  <td className="py-3 px-4 text-slate-600">{p.email || '–'}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={ACCESS_TONE[a]} label={ACCESS_LABEL[a]} /> <span className="text-[11px] text-slate-500 ml-1">{ACCESS_LABEL[a]}</span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {a === 'GRANTED' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs px-2.5 py-1"
                        onClick={() => {
                          setSelectedId(p.patientId);
                          navigate('/doctor/dashboard');
                        }}
                      >
                        Open
                      </Button>
                    ) : a === 'NO_REQUEST' ? (
                      <Button variant="primary" size="sm" className="text-xs px-2.5 py-1" disabled={asking} onClick={() => ask(p.patientId)}>
                        Ask to see records
                      </Button>
                    ) : (
                      <span className="text-[11px] text-slate-500">Request sent</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </SimpleTable>
        </div>
      )}

      {view === 'records' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <SearchBox value={search} onChange={setSearch} placeholder="Search by report or patient" />
          </div>
          <SimpleTable
            headers={['Report', 'Patient', 'Uploaded', '']}
            count={shownRecords.length}
            empty="No reports yet. Reports appear here once a patient shares their records with you."
          >
            {shownRecords.map((r) => (
              <tr key={r.reportId} className="hover:bg-slate-50/60">
                <td className="py-3 px-4">
                  <span className="flex items-center gap-2 font-bold text-slate-900">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    {r.description || r.fileName}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-700">{nameOf(r.patientId)}</td>
                <td className="py-3 px-4 text-slate-500">{formatDate(r.createdAt)}</td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    {downloadBtn(r)}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs px-2 py-1"
                      onClick={() => {
                        setSelectedId(r.patientId);
                        navigate('/doctor/ai');
                      }}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      Summarise
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </SimpleTable>
        </div>
      )}

      {view === 'requests' && (
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Ask a patient to share their records</h3>
            <p className="text-xs text-slate-500">The patient sees your request on their dashboard and decides. You are told when they answer.</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label htmlFor="req-patient" className="block text-xs font-bold text-slate-700 mb-1">
                  Patient
                </label>
                <select id="req-patient" value={requestPatient} onChange={(e) => setRequestPatient(e.target.value)} className="w-full text-xs p-2.5 border border-slate-300 rounded-xl">
                  <option value="">Choose a patient…</option>
                  {patients
                    .filter((p) => (access[p.patientId] || 'NO_REQUEST') === 'NO_REQUEST')
                    .map((p) => (
                      <option key={p.patientId} value={p.patientId}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="req-reason" className="block text-xs font-bold text-slate-700 mb-1">
                  Why (shown to the patient)
                </label>
                <input
                  id="req-reason"
                  value={requestReason}
                  maxLength={200}
                  placeholder="e.g. Follow-up of your blood sugar"
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl"
                />
              </div>
              <Button variant="primary" size="sm" disabled={!requestPatient || asking} onClick={() => ask(requestPatient).then(() => setRequestPatient(''))}>
                <Send className="w-3.5 h-3.5 mr-1" />
                Send request
              </Button>
            </div>
          </Card>
          <SimpleTable headers={['Patient', 'Status']} count={granted.length + pending.length} empty="You have not asked anyone yet, and no one has shared their records with you.">
            {[...pending, ...granted].map((p) => (
              <tr key={p.patientId}>
                <td className="py-3 px-4 font-bold text-slate-900">
                  {p.name}
                  {reasons[p.patientId] && <span className="block text-[11px] font-normal text-slate-500">“{reasons[p.patientId]}”</span>}
                </td>
                <td className="py-3 px-4">
                  <StatusBadge status={ACCESS_TONE[access[p.patientId]]} label={ACCESS_LABEL[access[p.patientId]]} />
                </td>
              </tr>
            ))}
          </SimpleTable>
        </div>
      )}

      {view === 'ai' && (
        <div className="space-y-4">
          <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <label htmlFor="ai-patient" className="text-xs font-bold text-slate-700">
              Patient
            </label>
            <select id="ai-patient" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="text-xs p-2 border border-slate-300 rounded-xl sm:w-72">
              {granted.length === 0 && <option value="">No patient has shared their records yet – ask one under Record requests</option>}
              {granted.map((p) => (
                <option key={p.patientId} value={p.patientId}>
                  {p.name}
                </option>
              ))}
            </select>
          </Card>
          {selectedAccess === 'GRANTED' ? (
            <AiHealthAssistant patientId={selectedId} />
          ) : (
            <Card className="p-6 text-xs text-slate-600">Choose a patient who has shared their records with you.</Card>
          )}
        </div>
      )}

      {view === 'medications' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Pill className="w-4 h-4 text-emerald-600" /> Write a prescription
            </h3>
            <p className="text-xs text-slate-500 mb-4">Saved to the patient’s record, where they can see it. The patient must have shared their records with you.</p>
            {rxForm()}
          </Card>
          {medsTable(
            meds.filter((m) => m.prescribedBy === doctorId),
            true
          )}
        </div>
      )}

      {view === 'activity' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <span>Activity</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Reports opened, notes written and requests sent with this account.</p>
            </div>
            <Button variant="outline" size="sm" onClick={openActivityModal} className="text-xs font-semibold">
              Open full history
            </Button>
          </div>
          <LiveActivityTimeline accent="emerald" />
        </Card>
      )}

      {view === 'settings' && (
        <div className="space-y-6">
          <ChangePasswordCard />
          <WalletCard />
          <ActiveSessionsCard />
          <ProfileSettingsCard
            section="practice"
            title="Practice details"
            description="Shown to patients when you ask to see their records. Everything here is optional."
            defaults={{ name: user?.name || '' }}
            onMessage={say}
            fields={[
              { key: 'name', label: 'Name as shown to patients' },
              { key: 'license', label: 'Council registration number', placeholder: 'e.g. NMC-10293 (Nepal) or NMC/State council no. (India)' },
              { key: 'department', label: 'Specialty', placeholder: 'e.g. Internal medicine' },
              { key: 'hospital', label: 'Hospital or clinic', placeholder: 'e.g. Himal Care Hospital' },
              { key: 'phone', label: 'Phone', placeholder: '+977 98XXXXXXXX' },
              { key: 'email', label: 'Contact email', type: 'email' }
            ]}
          />
        </div>
      )}
    </div>
  );
};

export default DoctorDashboardPage;
