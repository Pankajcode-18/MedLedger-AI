import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Download, FileText, FlaskConical, History, Plus, ShieldCheck, UploadCloud, AlertTriangle } from 'lucide-react';
import { ActiveSessionsCard } from '../../components/common/ActiveSessionsCard.js';
import { ChangePasswordCard } from '../../components/common/ChangePasswordCard.js';
import { WalletCard } from '../../components/common/WalletCard.js';
import { LiveActivityTimeline } from '../../components/common/LiveActivityTimeline.js';
import { ProfileSettingsCard } from '../../components/common/ProfileSettingsCard.js';
import { RecordChecker } from '../../components/common/RecordChecker.js';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Dropzone } from '../../components/common/Dropzone.js';
import {
  Field,
  FilterChips,
  NoticeBar,
  Notice,
  PageHeader,
  SearchBox,
  SelectField,
  SimpleTable,
  StatCard,
  StatusBadge
} from '../../components/common/PageKit.js';
import { useAuthStore } from '../../store/authStore.js';
import { useUIStore } from '../../store/uiStore.js';
import { authApi } from '../../api/authApi.js';
import { recordsApi, recordErrorMessage } from '../../api/recordsApi.js';
import { samplesApi, LabSample } from '../../api/orgApi.js';
import { MedicalRecord, Patient } from '../../types/index.js';
import { errorText, formatAgo, formatDate } from '../../lib/format.js';

const titleCase = (s?: string) => (s || '').replace(/\b\w/g, (c) => c.toUpperCase());

const TITLES: Record<string, string> = {'dashboard': 'Overview', 'samples': 'Samples', 'reports': 'Reports', 'upload': 'Upload a report', 'verify': 'Check a report', 'activity': 'Activity', 'settings': 'Settings'};

const SUBTITLES: Record<string, string> = {
  dashboard: 'Samples waiting, urgent tests and reports ready to upload.',
  samples: 'Every sample received, from collection to uploaded report.',
  reports: 'Reports this lab has uploaded.',
  upload: 'Add a test report to a patient’s record.',
  verify: 'Check that a report has not been changed since upload.',
  activity: 'Everything done with this account, newest first.',
  settings: 'Your password, sessions and lab details.'
};

const NEXT: Record<LabSample['status'], { label: string; to?: LabSample['status'] } | null> = {
  Received: { label: 'Start testing', to: 'Processing' },
  Processing: { label: 'Results ready', to: 'Report ready' },
  'Report ready': { label: 'Upload report' },
  Uploaded: null
};

const TEMPLATES = [
  { name: 'Complete blood count (CBC)', notes: 'Haemoglobin: 13.8 g/dL\nWBC: 7,200 /µL\nPlatelets: 2,45,000 /µL\nNeutrophils: 60%' },
  { name: 'Fasting blood sugar', notes: 'Fasting blood sugar: 96 mg/dL' },
  { name: 'Lipid profile', notes: 'Total cholesterol: 182 mg/dL\nTriglycerides: 128 mg/dL\nHDL: 52 mg/dL\nLDL: 104 mg/dL' },
  { name: 'Kidney function test', notes: 'Urea: 28 mg/dL\nCreatinine: 0.9 mg/dL\nSodium: 139 mmol/L\nPotassium: 4.2 mmol/L' }
];

export const LabDashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { openActivityModal } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.toLowerCase();
  const view = (['samples', 'reports', 'upload', 'verify', 'activity', 'settings'] as const).find((v) => path.includes(`/${v}`)) || 'dashboard';

  const [notice, setNotice] = useState<Notice>(null);
  const say = (text: string, ok = true) => setNotice({ text, tone: ok ? 'ok' : 'error' });

  const [samples, setSamples] = useState<LabSample[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [s, r, p] = await Promise.allSettled([samplesApi.list(), recordsApi.getRecords({ summary: true }), authApi.getPatients()]);
    if (s.status === 'fulfilled') setSamples(s.value);
    else say('Samples could not be loaded. Please reload the page.', false);
    if (r.status === 'fulfilled') setRecords(r.value);
    if (p.status === 'fulfilled') setPatients(p.value);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const patientName = (id: string) => titleCase(patients.find((p) => p.patientId === id)?.name) || `Patient ${id}`;

  // ---------- samples ----------
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Urgent' | 'Received' | 'Processing' | 'Report ready' | 'Uploaded'>('All');
  const [sampleModal, setSampleModal] = useState(false);
  const blankSample = { patientId: '', patientName: '', test: '', category: 'Biochemistry', priority: 'Routine' };
  const [newSample, setNewSample] = useState(blankSample);
  const [busy, setBusy] = useState(false);

  const logSample = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await samplesApi.create({ ...newSample, patientId: newSample.patientId || undefined });
      setSamples((prev) => [created, ...prev]);
      setSampleModal(false);
      setNewSample(blankSample);
      say(`Sample ${created.id} logged for ${created.patientName}.`);
    } catch (err) {
      say(errorText(err, 'The sample could not be saved.'), false);
    } finally {
      setBusy(false);
    }
  };

  // upload form (also used for the "Upload report" step of a sample)
  const [upload, setUpload] = useState({ patientId: '', title: '', notes: '', sampleId: '' });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<{ reportId: string; patient: string } | null>(null);

  const advance = async (s: LabSample) => {
    const next = NEXT[s.status];
    if (!next) return;
    if (!next.to) {
      setUpload({ patientId: s.patientId || '', title: s.test, notes: '', sampleId: s.id });
      setUploaded(null);
      navigate('/lab/upload');
      return;
    }
    try {
      const updated = await samplesApi.update(s.id, { status: next.to });
      setSamples((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
      say(`${s.test} for ${s.patientName}: ${next.to === 'Processing' ? 'testing started' : 'results are ready to upload'}.`);
    } catch (err) {
      say(errorText(err, 'The change could not be saved.'), false);
    }
  };

  const submitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upload.patientId) {
      say('Choose the patient this report belongs to.', false);
      return;
    }
    if (!file && !upload.notes.trim()) {
      say('Attach the report file or type the results.', false);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      if (file) form.append('file', file);
      form.append('patientId', upload.patientId);
      form.append('clinicalNotes', upload.notes);
      form.append('reportTitle', upload.title || 'Lab report');
      const res = await recordsApi.uploadRecord(form);
      if (upload.sampleId) {
        const s = samples.find((x) => x.id === upload.sampleId);
        if (s && s.status === 'Report ready') {
          const updated = await samplesApi.update(s.id, { status: 'Uploaded', reportId: res.reportId }).catch(() => null);
          if (updated) setSamples((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
        }
      }
      setUploaded({ reportId: res.reportId, patient: patientName(upload.patientId) });
      say(`Report uploaded to ${patientName(upload.patientId)}’s record.`);
      setUpload({ patientId: '', title: '', notes: '', sampleId: '' });
      setFile(null);
      recordsApi.getRecords({ summary: true }).then(setRecords).catch(() => undefined);
    } catch (err) {
      say(await recordErrorMessage(err), false);
    } finally {
      setUploading(false);
    }
  };

  const [checkQuery, setCheckQuery] = useState('');

  const shown = samples.filter((s) => {
    const q = search.toLowerCase();
    const f = filter === 'All' || (filter === 'Urgent' ? s.priority === 'Urgent' && s.status !== 'Uploaded' : s.status === filter);
    return f && (!q || [s.patientName, s.test, s.id].some((v) => (v || '').toLowerCase().includes(q)));
  });
  const waiting = samples.filter((s) => s.status === 'Received' || s.status === 'Processing');

  const sampleTable = (list: LabSample[], empty: string) => (
    <SimpleTable headers={['Sample', 'Patient', 'Test', 'Collected', 'Status', '']} count={list.length} empty={empty}>
      {list.map((s) => {
        const next = NEXT[s.status];
        return (
          <tr key={s.id} className="hover:bg-slate-50/60">
            <td className="py-3 px-4 font-mono text-slate-600">
              {s.id}
              {s.priority === 'Urgent' && (
                <span className="ml-2">
                  <StatusBadge status="Urgent" />
                </span>
              )}
            </td>
            <td className="py-3 px-4 font-bold text-slate-900">{s.patientName}</td>
            <td className="py-3 px-4 text-slate-700">
              {s.test}
              {s.category && <span className="block text-[11px] text-slate-400">{s.category}</span>}
            </td>
            <td className="py-3 px-4 text-slate-500">{formatAgo(s.collectedAt)}</td>
            <td className="py-3 px-4">
              <StatusBadge status={s.status} />
            </td>
            <td className="py-3 px-4 text-right whitespace-nowrap">
              {next ? (
                <Button variant={next.to ? 'outline' : 'primary'} size="sm" className="text-xs px-2.5 py-1" onClick={() => advance(s)}>
                  {next.label}
                </Button>
              ) : s.reportId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs px-2 py-1"
                  onClick={() => {
                    setCheckQuery(s.reportId as string);
                    navigate('/lab/verify');
                  }}
                >
                  Check report
                </Button>
              ) : null}
            </td>
          </tr>
        );
      })}
    </SimpleTable>
  );

  return (
    <div className="space-y-6 pb-12">
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />

      <PageHeader
        tag={titleCase(user?.name) || 'Laboratory'}
        title={TITLES[view]}
        subtitle={SUBTITLES[view]}
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => setSampleModal(true)} className="text-xs font-bold flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Log a sample</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/lab/upload')} className="text-xs font-bold flex items-center gap-1.5">
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload a report</span>
            </Button>
          </>
        }
      />

      {view === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Samples waiting" value={loading ? '…' : waiting.length} note="Received or being tested" icon={<FlaskConical className="w-4 h-4" />} onClick={() => navigate('/lab/samples')} />
            <StatCard
              label="Urgent"
              value={loading ? '…' : samples.filter((s) => s.priority === 'Urgent' && s.status !== 'Uploaded').length}
              note="Not yet uploaded"
              icon={<AlertTriangle className="w-4 h-4" />}
              onClick={() => {
                setFilter('Urgent');
                navigate('/lab/samples');
              }}
            />
            <StatCard label="Ready to upload" value={loading ? '…' : samples.filter((s) => s.status === 'Report ready').length} note="Results done" icon={<UploadCloud className="w-4 h-4" />} onClick={() => navigate('/lab/samples')} />
            <StatCard label="Reports uploaded" value={loading ? '…' : records.length} note="Locked and fingerprinted" icon={<FileText className="w-4 h-4" />} onClick={() => navigate('/lab/reports')} />
          </div>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Work queue</h3>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate('/lab/samples')}>
                See all samples
              </Button>
            </div>
            {sampleTable(
              samples.filter((s) => s.status !== 'Uploaded').slice(0, 6),
              'Nothing waiting. New samples appear here when you log them.'
            )}
          </Card>
        </div>
      )}

      {view === 'samples' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <SearchBox value={search} onChange={setSearch} placeholder="Search by patient, test or sample number" />
            <FilterChips options={['All', 'Urgent', 'Received', 'Processing', 'Report ready', 'Uploaded'] as const} value={filter} onChange={setFilter} />
          </div>
          {sampleTable(shown, 'No samples match your search. Try another name or clear the filter.')}
        </div>
      )}

      {view === 'reports' && (
        <SimpleTable headers={['Report', 'Patient', 'Uploaded', '']} count={records.length} empty="No reports uploaded yet. Use “Upload a report” to add the first one.">
          {records.map((r) => (
            <tr key={r.reportId} className="hover:bg-slate-50/60">
              <td className="py-3 px-4">
                <span className="flex items-center gap-2 font-bold text-slate-900">
                  <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                  {r.description || r.fileName}
                </span>
                <span className="text-[11px] text-slate-400">Report {r.reportId}</span>
              </td>
              <td className="py-3 px-4 text-slate-700">{patientName(r.patientId)}</td>
              <td className="py-3 px-4 text-slate-500">{formatDate(r.createdAt)}</td>
              <td className="py-3 px-4 text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 py-1"
                    onClick={() => recordsApi.downloadRecord(r.reportId, r.fileName).catch((e: Error) => say(e.message, false))}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 py-1"
                    onClick={() => {
                      setCheckQuery(r.reportId);
                      navigate('/lab/verify');
                    }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Check
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </SimpleTable>
      )}

      {view === 'upload' && (
        <Card className="p-6 max-w-3xl mx-auto">
          <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-emerald-600" />
            <span>Upload a report</span>
          </h3>
          <p className="text-xs text-slate-500 mb-5">
            The report is locked so only people the patient allows can open it, and added to the patient’s record. The patient can see it straight away.
          </p>

          {uploaded && (
            <div className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Saved to {uploaded.patient}’s record as report {uploaded.reportId}.
              </span>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setCheckQuery(uploaded.reportId);
                  navigate('/lab/verify');
                }}
              >
                Check it
              </Button>
            </div>
          )}

          <div className="mb-4">
            <span className="text-[11px] font-bold text-slate-500 block mb-2">Start from a template</span>
            <div className="flex items-center gap-2 flex-wrap">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setUpload((u) => ({ ...u, title: t.name, notes: t.notes }))}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-medium"
                >
                  + {t.name}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={submitUpload} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="upload-patient" className="block text-xs font-bold text-slate-700 mb-1">
                  Patient <span className="text-rose-600">*</span>
                </label>
                <select
                  id="upload-patient"
                  value={upload.patientId}
                  onChange={(e) => setUpload({ ...upload, patientId: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl"
                >
                  <option value="">Choose a patient…</option>
                  {patients.map((p) => (
                    <option key={p.patientId} value={p.patientId}>
                      {titleCase(p.name)}
                    </option>
                  ))}
                </select>
              </div>
              <Field label="Report title" placeholder="e.g. Lipid profile" value={upload.title} onChange={(v) => setUpload({ ...upload, title: v })} />
            </div>
            <div>
              <label htmlFor="upload-notes" className="block text-xs font-bold text-slate-700 mb-1">
                Results
              </label>
              <textarea
                id="upload-notes"
                rows={5}
                value={upload.notes}
                placeholder="One result per line, for example: Haemoglobin: 13.8 g/dL"
                onChange={(e) => setUpload({ ...upload, notes: e.target.value })}
                className="w-full text-xs p-3 border border-slate-300 rounded-xl font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-700 mb-1">Report file (optional)</span>
              <Dropzone onFileSelect={(f) => setFile(f)} accept=".pdf,.docx,.png,.jpg,.jpeg" label="Drop the PDF, Word file or photo of the report here" />
              {file && (
                <div className="mt-2 text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Selected: {file.name}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" disabled={uploading} className="text-xs font-bold flex items-center gap-1.5">
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{uploading ? 'Uploading and locking…' : 'Upload report'}</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {view === 'verify' && (
        <Card className="p-6 max-w-3xl mx-auto">
          <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Check a report</span>
          </h3>
          <p className="text-xs text-slate-500 mb-6">Confirm that a report has not been changed since it was uploaded.</p>
          <RecordChecker key={checkQuery} initialQuery={checkQuery} />
        </Card>
      )}

      {view === 'activity' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <span>Activity</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Samples logged, reports uploaded and checks run with this account.</p>
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
            section="lab-profile"
            title="Lab details"
            description="Printed on reports and shown to patients. Everything here is optional."
            defaults={{ name: user?.name || '' }}
            onMessage={say}
            fields={[
              { key: 'name', label: 'Lab name' },
              { key: 'registrationNo', label: 'Registration number', placeholder: 'e.g. LAB-2075-042' },
              { key: 'accreditation', label: 'Accreditation', placeholder: 'e.g. NPHL (Nepal) or NABL (India)' },
              { key: 'director', label: 'Pathologist in charge' },
              { key: 'phone', label: 'Phone', placeholder: '+977 1 5523456' },
              { key: 'address', label: 'Address', placeholder: 'e.g. Pulchowk, Lalitpur' }
            ]}
          />
        </div>
      )}

      <Modal isOpen={sampleModal} onClose={() => setSampleModal(false)} title="Log a sample" maxWidth="md">
        <form onSubmit={logSample} className="space-y-4">
          <div>
            <label htmlFor="sample-patient" className="block text-xs font-bold text-slate-700 mb-1">
              Registered patient (optional)
            </label>
            <select
              id="sample-patient"
              value={newSample.patientId}
              onChange={(e) => {
                const p = patients.find((x) => x.patientId === e.target.value);
                setNewSample({ ...newSample, patientId: e.target.value, patientName: p ? titleCase(p.name) : newSample.patientName });
              }}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl"
            >
              <option value="">Not registered in MedLedger</option>
              {patients.map((p) => (
                <option key={p.patientId} value={p.patientId}>
                  {titleCase(p.name)}
                </option>
              ))}
            </select>
          </div>
          <Field label="Patient name" required value={newSample.patientName} onChange={(v) => setNewSample({ ...newSample, patientName: v })} />
          <Field label="Test" required placeholder="e.g. Complete blood count" value={newSample.test} onChange={(v) => setNewSample({ ...newSample, test: v })} />
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Section"
              value={newSample.category}
              onChange={(v) => setNewSample({ ...newSample, category: v })}
              options={['Biochemistry', 'Haematology', 'Microbiology', 'Pathology', 'Serology', 'Imaging']}
            />
            <SelectField label="Priority" value={newSample.priority} onChange={(v) => setNewSample({ ...newSample, priority: v })} options={['Routine', 'Urgent']} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSampleModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? 'Saving…' : 'Log sample'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LabDashboardPage;
