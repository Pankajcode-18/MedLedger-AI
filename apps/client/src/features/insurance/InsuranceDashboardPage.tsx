import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, FileText, History, Plus, ShieldCheck, UserPlus, Users, Wallet } from 'lucide-react';
import { ActiveSessionsCard } from '../../components/common/ActiveSessionsCard.js';
import { ChangePasswordCard } from '../../components/common/ChangePasswordCard.js';
import { WalletCard } from '../../components/common/WalletCard.js';
import { LiveActivityTimeline } from '../../components/common/LiveActivityTimeline.js';
import { ProfileSettingsCard } from '../../components/common/ProfileSettingsCard.js';
import { RecordChecker } from '../../components/common/RecordChecker.js';
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
import { claimsApi, policyholdersApi, Claim, Currency, Policyholder } from '../../api/orgApi.js';
import { Patient } from '../../types/index.js';
import { errorText, formatDate, formatMoney } from '../../lib/format.js';

const titleCase = (s?: string) => (s || '').replace(/\b\w/g, (c) => c.toUpperCase());

const TITLES: Record<string, string> = {'dashboard': 'Overview', 'claims': 'Claims', 'pending': 'Waiting for a decision', 'policyholders': 'Policyholders', 'verify': 'Check a claim document', 'activity': 'Activity', 'settings': 'Settings'};

const SUBTITLES: Record<string, string> = {
  dashboard: 'Claims waiting for a decision, approved claims to pay, and policies.',
  claims: 'Every claim received, with its status and amount.',
  pending: 'Claims waiting for your decision.',
  policyholders: 'People insured with you and their policies.',
  verify: 'Check that the report behind a claim has not been changed.',
  activity: 'Everything done with this account, newest first.',
  settings: 'Your password, sessions and company details.'
};

type ClaimFilter = 'All' | Claim['status'];

export const InsuranceDashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { openActivityModal } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.toLowerCase();
  const view = (['claims', 'pending', 'policyholders', 'verify', 'activity', 'settings'] as const).find((v) => path.includes(`/${v}`)) || 'dashboard';

  const [notice, setNotice] = useState<Notice>(null);
  const say = (text: string, ok = true) => setNotice({ text, tone: ok ? 'ok' : 'error' });

  const [claims, setClaims] = useState<Claim[]>([]);
  const [holders, setHolders] = useState<Policyholder[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, h, p] = await Promise.allSettled([claimsApi.list(), policyholdersApi.list(), authApi.getPatients()]);
      if (c.status === 'fulfilled') setClaims(c.value);
      else say('Claims could not be loaded. Please reload the page.', false);
      if (h.status === 'fulfilled') setHolders(h.value);
      if (p.status === 'fulfilled') setPatients(p.value);
      setLoading(false);
    })();
  }, []);

  const replaceClaim = (c: Claim) => setClaims((prev) => prev.map((x) => (x.id === c.id ? c : x)));

  // ---------- claims list ----------
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClaimFilter>('All');
  const waiting = claims.filter((c) => c.status === 'Submitted' || c.status === 'Needs information');
  const toPay = claims.filter((c) => c.status === 'Approved');
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const paidThisMonth = claims.filter((c) => c.status === 'Paid' && new Date(c.paidAt || c.updatedAt).getTime() >= monthStart);
  const sum = (list: Claim[], field: 'amount' | 'approvedAmount' = 'amount') =>
    list.reduce((t, c) => t + Number((field === 'approvedAmount' ? c.approvedAmount ?? c.amount : c.amount) || 0), 0);

  const base = view === 'pending' ? waiting : claims;
  const shown = base.filter((c) => {
    const q = search.toLowerCase();
    return (
      (view === 'pending' || filter === 'All' || c.status === filter) &&
      (!q || [c.patientName, c.policyNo, c.provider, c.service, c.id].some((v) => (v || '').toLowerCase().includes(q)))
    );
  });

  // ---------- claim detail ----------
  const [open, setOpen] = useState<Claim | null>(null);
  const [approveAmount, setApproveAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const openClaim = (c: Claim) => {
    setOpen(c);
    setApproveAmount(String(c.approvedAmount ?? c.amount));
    setNote(c.note || '');
  };

  const decide = async (status: Claim['status']) => {
    if (!open) return;
    if ((status === 'Needs information' || status === 'Rejected') && !note.trim()) {
      say(status === 'Rejected' ? 'Write a short reason before rejecting.' : 'Write what information is needed.', false);
      return;
    }
    setBusy(true);
    try {
      const changes: Record<string, unknown> = { status };
      if (status === 'Approved') changes.approvedAmount = Number(approveAmount);
      if (note.trim()) changes.note = note.trim();
      const updated = await claimsApi.update(open.id, changes);
      replaceClaim(updated);
      setOpen(null);
      const msg: Record<string, string> = {
        Approved: `Claim ${updated.id} approved for ${formatMoney(updated.approvedAmount, updated.currency)}.`,
        Paid: `Claim ${updated.id} marked as paid. Record the bank transfer in your accounts system.`,
        Rejected: `Claim ${updated.id} rejected.`,
        'Needs information': `Claim ${updated.id} is waiting for more information.`,
        Submitted: `Claim ${updated.id} is back in the queue.`
      };
      say(msg[status]);
    } catch (err) {
      say(errorText(err, 'The decision could not be saved.'), false);
    } finally {
      setBusy(false);
    }
  };

  // ---------- new claim / policyholder ----------
  const [claimModal, setClaimModal] = useState(false);
  const blankClaim = { patientId: '', patientName: '', policyNo: '', provider: '', service: '', amount: '', currency: 'NPR', reportId: '' };
  const [newClaim, setNewClaim] = useState(blankClaim);
  const addClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await claimsApi.create({
        ...newClaim,
        amount: Number(newClaim.amount),
        patientId: newClaim.patientId || undefined,
        reportId: newClaim.reportId || undefined
      });
      setClaims((prev) => [created, ...prev]);
      setClaimModal(false);
      setNewClaim(blankClaim);
      say(`Claim ${created.id} added for ${created.patientName}.`);
    } catch (err) {
      say(errorText(err, 'The claim could not be saved.'), false);
    } finally {
      setBusy(false);
    }
  };

  const [holderModal, setHolderModal] = useState(false);
  const blankHolder = { patientId: '', name: '', policyNo: '', plan: '', sumInsured: '', currency: 'NPR', validTill: '', phone: '' };
  const [newHolder, setNewHolder] = useState(blankHolder);
  const addHolder = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await policyholdersApi.create({
        ...newHolder,
        sumInsured: Number(newHolder.sumInsured),
        patientId: newHolder.patientId || undefined,
        validTill: newHolder.validTill || undefined
      });
      setHolders((prev) => [created, ...prev]);
      setHolderModal(false);
      setNewHolder(blankHolder);
      say(`${created.name} added with policy ${created.policyNo}.`);
    } catch (err) {
      say(errorText(err, 'The policyholder could not be saved.'), false);
    } finally {
      setBusy(false);
    }
  };

  const patientPicker = (id: string, value: string, onPick: (pid: string, name: string) => void) => (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-slate-700 mb-1">
        Registered patient (optional)
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const p = patients.find((x) => x.patientId === e.target.value);
          onPick(e.target.value, p ? titleCase(p.name) : '');
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
  );

  const claimTable = (list: Claim[], empty: string) => (
    <SimpleTable headers={['Claim', 'Patient and policy', 'Treatment', 'Amount', 'Status', '']} count={list.length} empty={empty}>
      {list.map((c) => (
        <tr key={c.id} className="hover:bg-slate-50/60">
          <td className="py-3 px-4 font-mono text-slate-600">
            {c.id}
            <span className="block font-sans text-[11px] text-slate-400">{formatDate(c.createdAt)}</span>
          </td>
          <td className="py-3 px-4">
            <span className="font-bold text-slate-900 block">{c.patientName}</span>
            <span className="text-[11px] text-slate-500 font-mono">{c.policyNo}</span>
          </td>
          <td className="py-3 px-4 text-slate-700">
            {c.service}
            <span className="block text-[11px] text-slate-400">{c.provider}</span>
          </td>
          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
            {formatMoney(c.amount, c.currency)}
            {c.approvedAmount !== undefined && c.approvedAmount !== c.amount && (
              <span className="block text-[11px] font-normal text-slate-500">Approved {formatMoney(c.approvedAmount, c.currency)}</span>
            )}
          </td>
          <td className="py-3 px-4">
            <StatusBadge status={c.status} />
          </td>
          <td className="py-3 px-4 text-right">
            <Button variant="outline" size="sm" className="text-xs px-2.5 py-1" onClick={() => openClaim(c)}>
              {c.status === 'Paid' || c.status === 'Rejected' ? 'View' : 'Review'}
            </Button>
          </td>
        </tr>
      ))}
    </SimpleTable>
  );

  const [checkQuery, setCheckQuery] = useState('');
  const daysLeft = (d?: string) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000) : null);

  return (
    <div className="space-y-6 pb-12">
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />

      <PageHeader
        tag={titleCase(user?.name) || 'Insurance'}
        title={TITLES[view]}
        subtitle={SUBTITLES[view]}
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => setClaimModal(true)} className="text-xs font-bold flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Add a claim</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setHolderModal(true)} className="text-xs font-bold flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add a policyholder</span>
            </Button>
          </>
        }
      />

      {view === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Waiting for a decision" value={loading ? '…' : waiting.length} note={formatMoney(sum(waiting))} icon={<Clock className="w-4 h-4" />} onClick={() => navigate('/insurance/pending')} />
            <StatCard
              label="Approved, not paid"
              value={loading ? '…' : toPay.length}
              note={formatMoney(sum(toPay, 'approvedAmount'))}
              icon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => {
                setFilter('Approved');
                navigate('/insurance/claims');
              }}
            />
            <StatCard label="Paid this month" value={loading ? '…' : formatMoney(sum(paidThisMonth, 'approvedAmount'))} note={`${paidThisMonth.length} claims`} icon={<Wallet className="w-4 h-4" />} />
            <StatCard label="Active policies" value={loading ? '…' : holders.filter((h) => h.status !== 'Lapsed').length} note="Policyholders" icon={<Users className="w-4 h-4" />} onClick={() => navigate('/insurance/policyholders')} />
          </div>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Claims waiting for you</h3>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate('/insurance/claims')}>
                See all claims
              </Button>
            </div>
            {claimTable(waiting.slice(0, 5), 'Nothing is waiting. New claims appear here.')}
          </Card>
        </div>
      )}

      {(view === 'claims' || view === 'pending') && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <SearchBox value={search} onChange={setSearch} placeholder="Search by patient, policy, hospital or claim number" />
            {view === 'claims' && (
              <FilterChips options={['All', 'Submitted', 'Needs information', 'Approved', 'Rejected', 'Paid'] as const} value={filter} onChange={setFilter} />
            )}
          </div>
          {claimTable(shown, view === 'pending' ? 'Nothing is waiting for a decision.' : 'No claims match your search. Try another name or clear the filter.')}
        </div>
      )}

      {view === 'policyholders' && (
        <SimpleTable headers={['Name', 'Policy', 'Plan', 'Cover', 'Valid until', 'Phone']} count={holders.length} empty="No policyholders yet. Add one to start linking claims.">
          {holders.map((h) => {
            const left = daysLeft(h.validTill);
            return (
              <tr key={h.id} className="hover:bg-slate-50/60">
                <td className="py-3 px-4 font-bold text-slate-900">{h.name}</td>
                <td className="py-3 px-4 font-mono text-slate-600">{h.policyNo}</td>
                <td className="py-3 px-4 text-slate-700">{h.plan}</td>
                <td className="py-3 px-4 text-slate-900 font-semibold whitespace-nowrap">{formatMoney(h.sumInsured, h.currency)}</td>
                <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                  {formatDate(h.validTill)}
                  {left !== null && left <= 60 && (
                    <span className={`block text-[11px] ${left < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                      {left < 0 ? 'Expired' : `Renews in ${left} days`}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-slate-600">{h.phone || '–'}</td>
              </tr>
            );
          })}
        </SimpleTable>
      )}

      {view === 'verify' && (
        <Card className="p-6 max-w-3xl mx-auto">
          <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Check a claim document</span>
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Confirm that the medical report behind a claim has not been changed since it was uploaded. Enter the report ID from the claim, or the
            file fingerprint the hospital sent you.
          </p>
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
              <p className="text-xs text-slate-500 mt-0.5">Claims decided, policies added and checks run with this account.</p>
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
            section="payer"
            title="Company details"
            description="Shown to hospitals and policyholders. Everything here is optional."
            defaults={{ name: user?.name || '' }}
            onMessage={say}
            fields={[
              { key: 'name', label: 'Company name' },
              { key: 'licenceNo', label: 'Licence number', placeholder: 'Nepal Insurance Authority or IRDAI number' },
              { key: 'claimsEmail', label: 'Claims email', type: 'email' },
              { key: 'phone', label: 'Claims phone', placeholder: '+977 1 4234567' },
              { key: 'address', label: 'Address', placeholder: 'e.g. Kamaladi, Kathmandu' }
            ]}
          />
        </div>
      )}

      {/* Claim review */}
      <Modal isOpen={!!open} onClose={() => setOpen(null)} title={open ? `Claim ${open.id}` : ''} maxWidth="md">
        {open && (
          <div className="space-y-4 text-xs">
            <dl className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              {[
                ['Patient', open.patientName],
                ['Policy', open.policyNo],
                ['Hospital or clinic', open.provider],
                ['Treatment', open.service],
                ['Claimed', formatMoney(open.amount, open.currency)],
                ['Received', formatDate(open.createdAt)]
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] text-slate-500">{k}</dt>
                  <dd className="font-semibold text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="flex items-center gap-2">
              Status: <StatusBadge status={open.status} />
              {open.note && <span className="text-slate-600">— {open.note}</span>}
            </p>

            {open.reportId ? (
              <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-slate-700">
                  <FileText className="w-4 h-4" /> Supporting report {open.reportId}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setCheckQuery(open.reportId as string);
                    setOpen(null);
                    navigate('/insurance/verify');
                  }}
                >
                  Check this report
                </Button>
              </div>
            ) : (
              <p className="text-slate-500">No supporting report is attached to this claim.</p>
            )}

            {(open.status === 'Submitted' || open.status === 'Needs information') && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <Field label={`Amount to approve (${open.currency})`} type="number" value={approveAmount} onChange={setApproveAmount} />
                <Field label="Note to the hospital (needed to reject or ask for information)" value={note} onChange={setNote} />
                <div className="flex flex-wrap justify-end gap-2">
                  {open.status === 'Submitted' && (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => decide('Needs information')}>
                      Ask for information
                    </Button>
                  )}
                  <Button variant="danger" size="sm" disabled={busy} onClick={() => decide('Rejected')}>
                    Reject
                  </Button>
                  <Button variant="primary" size="sm" disabled={busy} onClick={() => decide('Approved')}>
                    Approve
                  </Button>
                </div>
              </div>
            )}
            {open.status === 'Approved' && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <span className="text-slate-600">Approved for {formatMoney(open.approvedAmount, open.currency)}. Mark it paid once the money is sent.</span>
                <Button variant="primary" size="sm" disabled={busy} onClick={() => decide('Paid')}>
                  Mark as paid
                </Button>
              </div>
            )}
            {open.status === 'Paid' && <p className="text-slate-600">Paid {formatDate(open.paidAt)}.</p>}
          </div>
        )}
      </Modal>

      <Modal isOpen={claimModal} onClose={() => setClaimModal(false)} title="Add a claim" maxWidth="md">
        <form onSubmit={addClaim} className="space-y-4">
          {patientPicker('claim-patient', newClaim.patientId, (pid, name) =>
            setNewClaim({
              ...newClaim,
              patientId: pid,
              patientName: name || newClaim.patientName,
              policyNo: holders.find((h) => h.patientId === pid)?.policyNo || newClaim.policyNo
            })
          )}
          <Field label="Patient name" required value={newClaim.patientName} onChange={(v) => setNewClaim({ ...newClaim, patientName: v })} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Policy number" required value={newClaim.policyNo} onChange={(v) => setNewClaim({ ...newClaim, policyNo: v })} />
            <Field label="Hospital or clinic" required value={newClaim.provider} onChange={(v) => setNewClaim({ ...newClaim, provider: v })} />
          </div>
          <Field label="Treatment or test" required value={newClaim.service} onChange={(v) => setNewClaim({ ...newClaim, service: v })} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount claimed" type="number" required value={newClaim.amount} onChange={(v) => setNewClaim({ ...newClaim, amount: v })} />
            <SelectField label="Currency" value={newClaim.currency} onChange={(v) => setNewClaim({ ...newClaim, currency: v as Currency })} options={['NPR', 'INR']} />
          </div>
          <Field
            label="Supporting report ID (optional)"
            hint="The report number from MedLedger, so you can check it was not changed."
            value={newClaim.reportId}
            onChange={(v) => setNewClaim({ ...newClaim, reportId: v })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setClaimModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? 'Saving…' : 'Add claim'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={holderModal} onClose={() => setHolderModal(false)} title="Add a policyholder" maxWidth="md">
        <form onSubmit={addHolder} className="space-y-4">
          {patientPicker('holder-patient', newHolder.patientId, (pid, name) => setNewHolder({ ...newHolder, patientId: pid, name: name || newHolder.name }))}
          <Field label="Full name" required value={newHolder.name} onChange={(v) => setNewHolder({ ...newHolder, name: v })} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Policy number" required value={newHolder.policyNo} onChange={(v) => setNewHolder({ ...newHolder, policyNo: v })} />
            <Field label="Plan" required placeholder="e.g. Family Health" value={newHolder.plan} onChange={(v) => setNewHolder({ ...newHolder, plan: v })} />
            <Field label="Cover amount" type="number" required value={newHolder.sumInsured} onChange={(v) => setNewHolder({ ...newHolder, sumInsured: v })} />
            <SelectField label="Currency" value={newHolder.currency} onChange={(v) => setNewHolder({ ...newHolder, currency: v })} options={['NPR', 'INR']} />
            <Field label="Valid until" type="date" value={newHolder.validTill} onChange={(v) => setNewHolder({ ...newHolder, validTill: v })} />
            <Field label="Phone" placeholder="+977 98XXXXXXXX" value={newHolder.phone} onChange={(v) => setNewHolder({ ...newHolder, phone: v })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setHolderModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? 'Saving…' : 'Add policyholder'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default InsuranceDashboardPage;
