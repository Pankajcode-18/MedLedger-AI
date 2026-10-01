import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bed, Download, FileText, History, Pill, Plus, Stethoscope, UserPlus, Users, HeartPulse } from 'lucide-react';
import { ActiveSessionsCard } from '../../components/common/ActiveSessionsCard.js';
import { ChangePasswordCard } from '../../components/common/ChangePasswordCard.js';
import { WalletCard } from '../../components/common/WalletCard.js';
import { LiveActivityTimeline } from '../../components/common/LiveActivityTimeline.js';
import { ProfileSettingsCard } from '../../components/common/ProfileSettingsCard.js';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
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
import { recordsApi } from '../../api/recordsApi.js';
import { prescriptionsApi, Prescription } from '../../api/prescriptionsApi.js';
import { admissionsApi, staffApi, Admission, StaffMember } from '../../api/orgApi.js';
import { Doctor, MedicalRecord, Patient } from '../../types/index.js';
import { errorText, formatDate, formatDateTime } from '../../lib/format.js';

const titleCase = (s?: string) => (s || '').replace(/\b\w/g, (c) => c.toUpperCase());

const TITLES: Record<string, string> = {'dashboard': 'Overview', 'patients': 'Patients in hospital', 'staff': 'Staff', 'admissions': 'Admissions', 'records': 'Reports', 'prescriptions': 'Pharmacy', 'activity': 'Activity', 'settings': 'Settings'};

const SUBTITLES: Record<string, string> = {
  dashboard: 'Patients in hospital, staff on duty and recent admissions.',
  patients: 'Patients who are in the hospital right now.',
  staff: 'Doctors, nurses and other staff at this hospital.',
  admissions: 'Every admission, with ward, bed and doctor in charge.',
  records: 'Reports stored for patients of this hospital.',
  prescriptions: 'Medicines prescribed for patients currently admitted here.',
  activity: 'Everything done with this account, newest first.',
  settings: 'Your password, sessions and hospital details.'
};

export const HospitalDashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { openActivityModal } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname.toLowerCase();
  const view =
    (['patients', 'staff', 'admissions', 'records', 'prescriptions', 'activity', 'settings'] as const).find((v) =>
      path.includes(`/${v}`)
    ) || 'dashboard';

  const [notice, setNotice] = useState<Notice>(null);
  const say = (text: string, ok = true) => setNotice({ text, tone: ok ? 'ok' : 'error' });

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [meds, setMeds] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      staffApi.list(),
      admissionsApi.list(),
      recordsApi.getRecords({ summary: true }),
      prescriptionsApi.list(),
      authApi.getPatients(),
      authApi.getDoctors()
    ]);
    const [s, a, r, m, p, d] = results;
    if (s.status === 'fulfilled') setStaff(s.value);
    if (a.status === 'fulfilled') setAdmissions(a.value);
    if (r.status === 'fulfilled') setRecords(r.value);
    if (m.status === 'fulfilled') setMeds(m.value);
    if (p.status === 'fulfilled') setPatients(p.value);
    if (d.status === 'fulfilled') setDoctors(d.value);
    if (results.slice(0, 2).some((x) => x.status === 'rejected')) say('Some hospital data could not be loaded. Please reload the page.', false);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const inHospital = admissions.filter((a) => a.status !== 'Discharged');
  const patientName = (id: string) => titleCase(patients.find((p) => p.patientId === id)?.name) || `Patient ${id}`;

  // ---------- staff ----------
  const [staffSearch, setStaffSearch] = useState('');
  const [staffFilter, setStaffFilter] = useState<'All' | 'On duty' | 'Off duty' | 'On leave'>('All');
  const [staffModal, setStaffModal] = useState(false);
  const blankStaff = { name: '', role: 'Doctor', department: '', licenceNo: '', phone: '' };
  const [newStaff, setNewStaff] = useState(blankStaff);
  const [busy, setBusy] = useState(false);

  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await staffApi.create(newStaff);
      setStaff((prev) => [created, ...prev]);
      setStaffModal(false);
      setNewStaff(blankStaff);
      say(`${created.name} has been added to the staff list.`);
    } catch (err) {
      say(errorText(err, 'The staff member could not be added.'), false);
    } finally {
      setBusy(false);
    }
  };

  const setStaffStatus = async (m: StaffMember, status: StaffMember['status']) => {
    try {
      const updated = await staffApi.update(m.id, { status });
      setStaff((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
      say(`${m.name} is now marked as ${status.toLowerCase()}.`);
    } catch (err) {
      say(errorText(err, 'The change could not be saved.'), false);
    }
  };

  const shownStaff = staff.filter((m) => {
    const q = staffSearch.toLowerCase();
    return (
      (staffFilter === 'All' || m.status === staffFilter) &&
      (!q || [m.name, m.role, m.department, m.licenceNo].some((v) => (v || '').toLowerCase().includes(q)))
    );
  });

  // ---------- admissions ----------
  const [admSearch, setAdmSearch] = useState('');
  const [admFilter, setAdmFilter] = useState<'All' | 'Admitted' | 'ICU' | 'Discharged'>('All');
  const [admitModal, setAdmitModal] = useState(false);
  const blankAdmit = { patientId: '', patientName: '', ward: '', bed: '', doctorName: '', reason: '', status: 'Admitted' };
  const [newAdmit, setNewAdmit] = useState(blankAdmit);
  const [confirmDischarge, setConfirmDischarge] = useState<string | null>(null);

  const admit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await admissionsApi.create({ ...newAdmit, patientId: newAdmit.patientId || undefined });
      setAdmissions((prev) => [created, ...prev]);
      setAdmitModal(false);
      setNewAdmit(blankAdmit);
      say(`${created.patientName} has been admitted to ${created.ward}, bed ${created.bed}.`);
    } catch (err) {
      say(errorText(err, 'The admission could not be saved.'), false);
    } finally {
      setBusy(false);
    }
  };

  const moveAdmission = async (a: Admission, status: Admission['status']) => {
    try {
      const updated = await admissionsApi.update(a.id, { status });
      setAdmissions((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
      setConfirmDischarge(null);
      say(
        status === 'Discharged'
          ? `${a.patientName} has been discharged.`
          : status === 'ICU'
            ? `${a.patientName} has been moved to the ICU.`
            : `${a.patientName} is back on the ward.`
      );
    } catch (err) {
      say(errorText(err, 'The change could not be saved.'), false);
    }
  };

  const shownAdmissions = (view === 'patients' ? inHospital : admissions).filter((a) => {
    const q = admSearch.toLowerCase();
    return (
      (view === 'patients' || admFilter === 'All' || a.status === admFilter) &&
      (!q || [a.patientName, a.ward, a.bed, a.doctorName].some((v) => (v || '').toLowerCase().includes(q)))
    );
  });

  const doctorNames = useMemo(
    () => [
      ...new Set([
        ...staff.filter((s) => /doctor|consultant|medical officer|surgeon/i.test(s.role) || s.name.startsWith('Dr')).map((s) => s.name),
        ...doctors.map((d) => d.name)
      ])
    ],
    [staff, doctors]
  );

  const admissionRows = (
    <SimpleTable
      headers={['Patient', 'Ward and bed', 'Doctor in charge', 'Admitted', 'Status', '']}
      count={shownAdmissions.length}
      empty={view === 'patients' ? 'No patients are in the hospital right now. Use “Admit a patient” to add one.' : 'No admissions match your search. Try another name or clear the filter.'}
    >
      {shownAdmissions.map((a) => (
        <tr key={a.id} className="hover:bg-slate-50/60">
          <td className="py-3 px-4">
            <span className="font-bold text-slate-900 block">{a.patientName}</span>
            {a.reason && <span className="text-[11px] text-slate-500">{a.reason}</span>}
          </td>
          <td className="py-3 px-4 text-slate-700">
            {a.ward}, bed {a.bed}
          </td>
          <td className="py-3 px-4 text-slate-700">{a.doctorName}</td>
          <td className="py-3 px-4 text-slate-500">
            {formatDate(a.admittedAt)}
            {a.dischargedAt && <span className="block text-[11px]">Discharged {formatDate(a.dischargedAt)}</span>}
          </td>
          <td className="py-3 px-4">
            <StatusBadge status={a.status} />
          </td>
          <td className="py-3 px-4 text-right whitespace-nowrap">
            {a.status !== 'Discharged' && (
              <div className="flex items-center justify-end gap-1.5">
                {a.status === 'Admitted' ? (
                  <Button variant="outline" size="sm" className="text-xs px-2.5 py-1" onClick={() => moveAdmission(a, 'ICU')}>
                    Move to ICU
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="text-xs px-2.5 py-1" onClick={() => moveAdmission(a, 'Admitted')}>
                    Back to ward
                  </Button>
                )}
                {confirmDischarge === a.id ? (
                  <>
                    <Button variant="primary" size="sm" className="text-xs px-2.5 py-1" onClick={() => moveAdmission(a, 'Discharged')}>
                      Confirm discharge
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs px-2 py-1" onClick={() => setConfirmDischarge(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" className="text-xs px-2.5 py-1" onClick={() => setConfirmDischarge(a.id)}>
                    Discharge
                  </Button>
                )}
              </div>
            )}
          </td>
        </tr>
      ))}
    </SimpleTable>
  );

  const hospitalName = titleCase(user?.name) || 'Hospital';

  return (
    <div className="space-y-6 pb-12">
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />

      <PageHeader
        tag={hospitalName}
        title={TITLES[view]}
        subtitle={SUBTITLES[view]}
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => setAdmitModal(true)} className="text-xs font-bold flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Admit a patient</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStaffModal(true)} className="text-xs font-bold flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add staff</span>
            </Button>
          </>
        }
      />

      {view === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="In hospital now" value={loading ? '…' : inHospital.length} note="Admitted or in ICU" icon={<Bed className="w-4 h-4" />} onClick={() => navigate('/hospital/patients')} />
            <StatCard label="In ICU" value={loading ? '…' : admissions.filter((a) => a.status === 'ICU').length} note="Intensive care" icon={<HeartPulse className="w-4 h-4" />} onClick={() => navigate('/hospital/admissions')} />
            <StatCard label="Staff on duty" value={loading ? '…' : staff.filter((s) => s.status === 'On duty').length} note={`of ${staff.length} staff`} icon={<Stethoscope className="w-4 h-4" />} onClick={() => navigate('/hospital/staff')} />
            <StatCard label="Reports stored" value={loading ? '…' : records.length} note="Locked and fingerprinted" icon={<FileText className="w-4 h-4" />} onClick={() => navigate('/hospital/records')} />
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Recent admissions</h3>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate('/hospital/admissions')}>
                See all
              </Button>
            </div>
            {admissions.length === 0 ? (
              <p className="text-xs text-slate-500">No admissions yet. Use “Admit a patient” to add the first one.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-xs">
                {admissions.slice(0, 5).map((a) => (
                  <li key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                    <span>
                      <span className="font-bold text-slate-900">{a.patientName}</span>
                      <span className="text-slate-500">
                        {' '}
                        · {a.ward}, bed {a.bed} · {a.doctorName}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <span className="text-slate-400">{formatDate(a.admittedAt)}</span>
                      <StatusBadge status={a.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {(view === 'patients' || view === 'admissions') && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <SearchBox value={admSearch} onChange={setAdmSearch} placeholder="Search by patient, ward, bed or doctor" />
            {view === 'admissions' && <FilterChips options={['All', 'Admitted', 'ICU', 'Discharged'] as const} value={admFilter} onChange={setAdmFilter} />}
          </div>
          {admissionRows}
        </div>
      )}

      {view === 'staff' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <SearchBox value={staffSearch} onChange={setStaffSearch} placeholder="Search by name, role, department or licence" />
            <FilterChips options={['All', 'On duty', 'Off duty', 'On leave'] as const} value={staffFilter} onChange={setStaffFilter} />
          </div>
          <SimpleTable headers={['Name', 'Role and department', 'Licence no.', 'Phone', 'Status']} count={shownStaff.length} empty="No staff match your search. Try another name or use “Add staff”.">
            {shownStaff.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50/60">
                <td className="py-3 px-4 font-bold text-slate-900">{m.name}</td>
                <td className="py-3 px-4 text-slate-700">
                  {m.role} · {m.department}
                </td>
                <td className="py-3 px-4 font-mono text-slate-600">{m.licenceNo || '–'}</td>
                <td className="py-3 px-4 text-slate-600">{m.phone || '–'}</td>
                <td className="py-3 px-4">
                  <label className="sr-only" htmlFor={`st-${m.id}`}>
                    Status of {m.name}
                  </label>
                  <select
                    id={`st-${m.id}`}
                    value={m.status}
                    onChange={(e) => setStaffStatus(m, e.target.value as StaffMember['status'])}
                    className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                  >
                    {['On duty', 'Off duty', 'On leave'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </SimpleTable>
        </div>
      )}

      {view === 'records' && (
        <SimpleTable headers={['Report', 'Patient', 'Uploaded', '']} count={records.length} empty="No reports have been stored yet. Reports appear here when a lab or doctor uploads one.">
          {records.map((r) => (
            <tr key={r.reportId} className="hover:bg-slate-50/60">
              <td className="py-3 px-4">
                <span className="flex items-center gap-2 font-bold text-slate-900">
                  <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                  {r.description || r.fileName}
                </span>
                <span className="text-[11px] text-slate-400">Report {r.reportId}</span>
              </td>
              <td className="py-3 px-4 text-slate-700">{patientName(r.patientId)}</td>
              <td className="py-3 px-4 text-slate-500">{formatDate(r.createdAt)}</td>
              <td className="py-3 px-4 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs px-2.5 py-1"
                  onClick={() => recordsApi.downloadRecord(r.reportId, r.fileName).catch((e: Error) => say(e.message, false))}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
              </td>
            </tr>
          ))}
        </SimpleTable>
      )}

      {view === 'prescriptions' && (
        <SimpleTable
          headers={['Medicine', 'Patient', 'How to take', 'Prescribed by', 'Status']}
          count={meds.length}
          empty="No medicines have been prescribed for patients currently in the hospital."
        >
          {meds.map((m) => (
            <tr key={m.id} className="hover:bg-slate-50/60">
              <td className="py-3 px-4 font-bold text-slate-900">
                <span className="flex items-center gap-2">
                  <Pill className="w-3.5 h-3.5 text-emerald-600" />
                  {m.drugName}
                </span>
              </td>
              <td className="py-3 px-4 text-slate-700">{titleCase(m.patientName) || patientName(m.patientId)}</td>
              <td className="py-3 px-4 text-slate-600">
                {m.dosage}, {m.frequency.toLowerCase()}, {m.duration}
              </td>
              <td className="py-3 px-4 text-slate-600">
                {m.prescriberName}
                <span className="block text-[11px] text-slate-400">{formatDateTime(m.createdAt)}</span>
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={m.status === 'Active' ? 'Active' : 'Lapsed'} label={m.status === 'Active' ? 'Taking now' : 'Stopped'} />
              </td>
            </tr>
          ))}
        </SimpleTable>
      )}

      {view === 'activity' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <span>Activity</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Admissions, staff changes and reports opened with this account.</p>
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
            section="facility"
            title="Hospital details"
            description="Shown to patients and other organisations. Everything here is optional."
            defaults={{ name: user?.name || '' }}
            onMessage={say}
            fields={[
              { key: 'name', label: 'Hospital name' },
              { key: 'registrationNo', label: 'Registration number', placeholder: 'e.g. HOS-2071-118' },
              { key: 'address', label: 'Address', placeholder: 'e.g. Maharajgunj, Kathmandu' },
              { key: 'emergencyPhone', label: 'Emergency phone', placeholder: '+977 1 4412345' },
              { key: 'email', label: 'Contact email', type: 'email' },
              { key: 'totalBeds', label: 'Number of beds', type: 'number' }
            ]}
          />
        </div>
      )}

      {/* Add staff */}
      <Modal isOpen={staffModal} onClose={() => setStaffModal(false)} title="Add a staff member" maxWidth="md">
        <form onSubmit={addStaff} className="space-y-4">
          <Field label="Full name" required value={newStaff.name} onChange={(v) => setNewStaff({ ...newStaff, name: v })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Role"
              value={newStaff.role}
              onChange={(v) => setNewStaff({ ...newStaff, role: v })}
              options={['Doctor', 'Consultant', 'Medical Officer', 'Staff Nurse', 'Pharmacist', 'Lab Technician', 'Administrator']}
            />
            <Field label="Department" required placeholder="e.g. Emergency" value={newStaff.department} onChange={(v) => setNewStaff({ ...newStaff, department: v })} />
            <Field
              label="Licence number"
              placeholder="e.g. NMC-12345 or NNC-1234"
              hint="Nepal Medical Council (NMC), Nursing Council (NNC) or Pharmacy Council (NPC)."
              value={newStaff.licenceNo}
              onChange={(v) => setNewStaff({ ...newStaff, licenceNo: v })}
            />
            <Field label="Phone" placeholder="+977 98XXXXXXXX" value={newStaff.phone} onChange={(v) => setNewStaff({ ...newStaff, phone: v })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setStaffModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? 'Saving…' : 'Add staff member'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Admit */}
      <Modal isOpen={admitModal} onClose={() => setAdmitModal(false)} title="Admit a patient" maxWidth="md">
        <form onSubmit={admit} className="space-y-4">
          <div>
            <label htmlFor="admit-patient" className="block text-xs font-bold text-slate-700 mb-1">
              Registered patient (optional)
            </label>
            <select
              id="admit-patient"
              value={newAdmit.patientId}
              onChange={(e) => {
                const p = patients.find((x) => x.patientId === e.target.value);
                setNewAdmit({ ...newAdmit, patientId: e.target.value, patientName: p ? titleCase(p.name) : newAdmit.patientName });
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
            <p className="mt-1 text-[11px] text-slate-500">Linking a registered patient lets their doctors and the pharmacy see this stay.</p>
          </div>
          <Field label="Patient name" required value={newAdmit.patientName} onChange={(v) => setNewAdmit({ ...newAdmit, patientName: v })} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ward" required placeholder="e.g. General Ward A" value={newAdmit.ward} onChange={(v) => setNewAdmit({ ...newAdmit, ward: v })} />
            <Field label="Bed" required placeholder="e.g. 12" value={newAdmit.bed} onChange={(v) => setNewAdmit({ ...newAdmit, bed: v })} />
          </div>
          <div>
            <label htmlFor="admit-doctor" className="block text-xs font-bold text-slate-700 mb-1">
              Doctor in charge <span className="text-rose-600">*</span>
            </label>
            <input
              id="admit-doctor"
              list="doctor-names"
              required
              value={newAdmit.doctorName}
              onChange={(e) => setNewAdmit({ ...newAdmit, doctorName: e.target.value })}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl"
            />
            <datalist id="doctor-names">
              {doctorNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <Field label="Reason for admission" placeholder="e.g. Chest pain" value={newAdmit.reason} onChange={(v) => setNewAdmit({ ...newAdmit, reason: v })} />
          <SelectField label="Admit to" value={newAdmit.status} onChange={(v) => setNewAdmit({ ...newAdmit, status: v })} options={['Admitted', 'ICU']} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAdmitModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? 'Saving…' : 'Admit patient'}
            </Button>
          </div>
        </form>
      </Modal>

      {loading && view !== 'settings' && view !== 'activity' && (
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <Users className="w-3.5 h-3.5" /> Loading hospital data…
        </p>
      )}
    </div>
  );
};

export default HospitalDashboardPage;
