import { formatDateTime } from '../../lib/format.js';
import React, { useState, useEffect } from 'react';
import { organisationsApi, Organisation } from '../../api/orgApi.js';
import { Field, PageHeader, SearchBox, SelectField, SimpleTable, StatusBadge } from '../../components/common/PageKit.js';
import { formatDate } from '../../lib/format.js';
import { systemApi, checkHealth, HealthCheck } from '../../api/systemApi.js';
import { ActiveSessionsCard } from '../../components/common/ActiveSessionsCard.js';
import { AdminUser } from '../../api/adminApi.js';
import { PasswordStrengthMeter } from '../../components/common/PasswordStrengthMeter.js';
import { validatePassword, apiErrorMessage } from '../../lib/password.js';
import { ChangePasswordCard } from '../../components/common/ChangePasswordCard.js';
import { WalletCard } from '../../components/common/WalletCard.js';
import { LiveActivityTimeline } from '../../components/common/LiveActivityTimeline.js';
import { useLocation, useNavigate } from 'react-router-dom';
import { adminApi, SecuritySummary } from '../../api/adminApi.js';
import { useUIStore } from '../../store/uiStore.js';
import { AuditLog } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.js';
import {
  ShieldAlert,
  Server,
  Users,
  FileText,
  Activity,
  CheckCircle2,
  Clock,
  Filter,
  Download,
  Search,
  RefreshCw,
  Sparkles,
  Shield,
  Layers,
  HardDrive,
  Database,
  Cpu,
  UserX,
  Building2,
  KeyRound,
  Check,
  X,
  History,
  Settings,
  Plus,
  Lock,
  Unlock,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: 'Patient' | 'Doctor' | 'Hospital' | 'Lab' | 'Insurance' | 'Administrator';
  organization: string;
  status: 'Active' | 'Disabled';
  created: string;
  lastActivity: string;
}

const ROLE_TO_LABEL: Record<string, ManagedUser['role']> = {
  patient: 'Patient',
  doctor: 'Doctor',
  hospital: 'Hospital',
  'hospital-admin': 'Hospital',
  lab: 'Lab',
  insurance: 'Insurance',
  admin: 'Administrator',
  'system-admin': 'Administrator'
};

const LABEL_TO_ROLE: Record<ManagedUser['role'], string> = {
  Patient: 'patient',
  Doctor: 'doctor',
  Hospital: 'hospital-admin',
  Lab: 'lab',
  Insurance: 'insurance',
  Administrator: 'admin'
};

const toManagedUser = (u: AdminUser): ManagedUser => ({
  id: u.userId,
  name: u.name,
  email: u.email,
  role: ROLE_TO_LABEL[u.role] || 'Patient',
  organization: u.isDemo ? 'Demo account' : '—',
  status: u.status || 'Active',
  created: formatDate(u.createdAt),
  lastActivity: u.walletAddress ? `${u.walletAddress.slice(0, 10)}…` : '—'
});


const PERMISSION_RULES = [
  { role: 'Patient', see: 'Their own reports, readings and medicines', add: 'Reports and readings to their own record', decide: 'Which doctors can see their records' },
  { role: 'Doctor', see: 'Records of patients who share with them', add: 'Notes and prescriptions for those patients', decide: '–' },
  { role: 'Hospital', see: 'Records of patients who share with it; its staff and admissions', add: 'Reports, staff and admissions', decide: '–' },
  { role: 'Laboratory', see: 'Reports it uploaded; its samples', add: 'Test reports for any registered patient', decide: '–' },
  { role: 'Insurance', see: 'Reports attached to its own claims', add: 'Claims and policyholders', decide: 'Whether to approve and pay a claim' },
  { role: 'Administrator', see: 'Everything, and every view is recorded', add: 'Accounts and organisations', decide: 'Which accounts can sign in' }
];

const SECURITY_LABELS: Record<string, string> = {
  LOGIN_FAILED: 'Wrong password',
  ACCOUNT_LOCKED: 'Account locked after too many wrong passwords',
  RECORD_TAMPER_DETECTED: 'A report failed its check',
  ACCOUNT_DISABLED: 'Account disabled',
  ACCOUNT_ENABLED: 'Account enabled again',
  PASSWORD_CHANGED: 'Password changed',
  PASSWORD_RESET_COMPLETED: 'Password reset'
};

export const AdminDashboardPage: React.FC = () => {
  const { openActivityModal, openBlocksModal } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [stats, setStats] = useState<{
    totalPatients: number;
    totalDoctors: number;
    totalReports: number;
    totalBlocks: number;
    networkStatus: string;
    ledger?: { mode: 'contract' | 'simulated'; network: string; chainId: number; contractAddress: string | null; intact: boolean };
    tamperAlerts: number;
  } | null>(null);
  const [security, setSecurity] = useState<SecuritySummary | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Subroute detection
  const path = location.pathname.toLowerCase();
  const isUsersView = path.includes('/users');
  const isOrgsView = path.includes('/orgs');
  const isPermissionsView = path.includes('/permissions');
  const isSecurityView = path.includes('/security');
  const isBlockchainView = path.includes('/blockchain');
  const isActivityView = path.includes('/activity');
  const isSettingsView = path.includes('/settings');
  const isDashboardHome =
    !isUsersView &&
    !isOrgsView &&
    !isPermissionsView &&
    !isSecurityView &&
    !isBlockchainView &&
    !isActivityView &&
    !isSettingsView;

  // User Management State
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'All' | 'Patient' | 'Doctor' | 'Hospital' | 'Lab' | 'Insurance' | 'Administrator'>('All');
  const [selectedUserToDisable, setSelectedUserToDisable] = useState<ManagedUser | null>(null);
  const [usersList, setUsersList] = useState<ManagedUser[]>([]);

  // Organizations State
  const [orgSearch, setOrgSearch] = useState('');
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [orgModal, setOrgModal] = useState(false);
  const blankOrg = { name: '', type: 'Hospital', registrationNo: '', district: '', country: 'Nepal', phone: '' };
  const [newOrg, setNewOrg] = useState(blankOrg);
  const [orgBusy, setOrgBusy] = useState(false);
  useEffect(() => {
    organisationsApi
      .list()
      .then(setOrgs)
      .catch(() => setOrgs([]));
  }, []);
  const addOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgBusy(true);
    try {
      const created = await organisationsApi.create(newOrg);
      setOrgs((prev) => [created, ...prev]);
      setOrgModal(false);
      setNewOrg(blankOrg);
      setToast(`${created.name} added. Check its registration and mark it verified when confirmed.`);
    } catch (err) {
      setToast(apiErrorMessage(err, 'The organisation could not be added.'));
    } finally {
      setOrgBusy(false);
    }
  };
  const verifyOrg = async (org: Organisation, verified: boolean) => {
    try {
      const updated = await organisationsApi.update(org.id, { verified });
      setOrgs((prev) => prev.map((o) => (o.id === org.id ? updated : o)));
      setToast(verified ? `${org.name} is now marked as verified.` : `${org.name} is no longer marked as verified.`);
    } catch (err) {
      setToast(apiErrorMessage(err, 'The change could not be saved.'));
    }
  };
  const shownOrgs = orgs.filter((o) => {
    const q = orgSearch.toLowerCase();
    return !q || [o.name, o.type, o.district, o.registrationNo].some((v) => (v || '').toLowerCase().includes(q));
  });

  // Add User Modal
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<ManagedUser['role']>('Doctor');
  const [newUserOrg, setNewUserOrg] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [addUserError, setAddUserError] = useState<string | null>(null);


  // Master Settings State


  useEffect(() => {
    loadAdminData();
  }, []);

  const [health, setHealth] = useState<HealthCheck | null>(null);
  useEffect(() => {
    systemApi.demoMode().then(setDemoMode);
    checkHealth().then(setHealth);
  }, []);

  useEffect(() => {
    if (!isSecurityView) return;
    setSecurityError(null);
    adminApi
      .getSecurity(30)
      .then(setSecurity)
      .catch(() => setSecurityError('Security figures could not be loaded. Please try again.'));
  }, [isSecurityView]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [s, logs] = await Promise.all([adminApi.getStats(), adminApi.getAllAuditLogs()]);
      setStats(s);
      setAuditLogs(logs);
      const accounts = await adminApi.listUsers();
      if (accounts.length > 0) setUsersList(accounts.map(toManagedUser));
    } catch (e) {
      console.error('Failed to load admin figures', e);
      setToast('Some figures could not be loaded. Check that the server is running, then reload the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId: string) => {
    const target = usersList.find((u) => u.id === userId);
    if (!target) return;
    const disable = target.status === 'Active';
    try {
      await adminApi.setUserStatus(userId, disable);
      setUsersList(usersList.map((u) => (u.id === userId ? { ...u, status: disable ? 'Disabled' : 'Active' } : u)));
      setToast(disable ? `${target.name} can no longer sign in.` : `${target.name} can sign in again.`);
    } catch (err) {
      setToast(apiErrorMessage(err, 'Could not update the account status.'));
    } finally {
      setSelectedUserToDisable(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError(null);
    if (!newUserName || !newUserEmail) return;
    const passwordProblem = validatePassword(newUserPassword);
    if (passwordProblem) {
      setAddUserError(passwordProblem);
      return;
    }
    try {
      const created = await adminApi.createUser({
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: LABEL_TO_ROLE[newUserRole]
      });
      setUsersList([{ ...toManagedUser(created), organization: newUserOrg || '—' }, ...usersList]);
      setToast(`Account created for ${created.name}. Share the temporary password securely and ask them to change it after signing in.`);
      setAddUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
    } catch (err) {
      setAddUserError(apiErrorMessage(err, 'Could not create the account.'));
    }
  };

  const filteredUsers = usersList.filter((u) => {
    const q = userSearch.toLowerCase();
    const matchesSearch = !userSearch || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.organization.toLowerCase().includes(q);
    const matchesRole = userRoleFilter === 'All' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs sm:text-sm animate-fade-in shadow-xs">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toast}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-emerald-700 hover:text-emerald-950 font-bold p-1">
            &times;
          </button>
        </div>
      )}

      <PageHeader
        tag="Administrator"
        title={
          isUsersView ? 'Accounts' : isOrgsView ? 'Organisations' : isPermissionsView ? 'What each account can do' : isSecurityView ? 'Security'
          : isBlockchainView ? 'Record history' : isActivityView ? 'Activity' : isSettingsView ? 'Settings' : 'Overview'
        }
        subtitle={
          isUsersView ? 'Create accounts for hospitals, labs and insurers, and switch accounts off or on.'
          : isOrgsView ? 'Hospitals, clinics, labs and insurers registered with MedLedger.'
          : isPermissionsView ? 'The rules the server applies to every account type.'
          : isSecurityView ? 'Sign-in problems, locked accounts and changed files.'
          : isBlockchainView ? 'The chain of fingerprints that shows a report has not been changed.'
          : isActivityView ? 'Everything done by every account, newest first.'
          : isSettingsView ? 'Your password, sessions and the server settings.'
          : 'Accounts, reports and system status at a glance.'
        }
      />

      {/* ========================================================================= */}
      {/* 1. SUB-VIEW: ADMIN DASHBOARD HOME (/admin/dashboard) */}
      {/* ========================================================================= */}
      {isDashboardHome && (
        <div className="space-y-8 animate-fade-in">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => navigate('/admin/users')}
              className="p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all shadow-2xs cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Registered Users</span>
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-950 block">{usersList.length}</span>
              <span className="text-[11px] text-sky-600 font-medium mt-1 block">Across 6 roles</span>
            </div>

            <div
              onClick={() => navigate('/admin/orgs')}
              className="p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all shadow-2xs cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Organizations</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-950 block">{orgs.length}</span>
              <span className="text-[11px] text-emerald-600 font-medium mt-1 block">Hospitals &amp; Labs</span>
            </div>

            <div
              onClick={() => navigate('/admin/blockchain')}
              className="p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all shadow-2xs cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Record history entries</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-950 block">{stats?.totalBlocks ?? 0}</span>
              <span className="text-[11px] text-indigo-600 font-medium mt-1 block">Entries in the record history</span>
            </div>

            <div
              onClick={() => navigate('/admin/security')}
              className="p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all shadow-2xs cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Changed files found</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <span className={`text-2xl sm:text-3xl font-black block ${(stats?.tamperAlerts ?? 0) > 0 ? 'text-amber-600' : 'text-slate-950'}`}>
                {stats?.tamperAlerts ?? 0}
              </span>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">Reports that failed a check</span>
            </div>
          </div>

          {/* System status */}
          <Card className="p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4">System status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  name: 'Server',
                  status: health ? (health.reachable ? 'Running' : 'Not reachable') : 'Checking…',
                  good: Boolean(health?.reachable),
                  detail: health?.reachable ? `Answered in ${health.ms} ms` : 'Start the server and reload',
                  icon: Cpu
                },
                {
                  name: 'Database',
                  status: health ? (health.mongoConnected ? 'MongoDB connected' : 'Local file storage') : 'Checking…',
                  good: Boolean(health?.mongoConnected),
                  detail: health?.mongoConnected ? 'Records stored in MongoDB' : 'Records stored in state.json on the server',
                  icon: Database
                },
                {
                  name: 'Record history',
                  status: stats?.networkStatus || '–',
                  good: stats?.ledger?.mode === 'contract' && stats.ledger.intact,
                  detail:
                    stats?.ledger?.mode === 'contract'
                      ? `Written to the HealthRecords contract on ${stats.ledger.network}`
                      : 'No contract set up – the history is kept on this server (see README)',
                  icon: Layers
                }
              ].map((svc, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svc.icon className="w-5 h-5 text-emerald-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">{svc.name}</span>
                      <span className="text-[10px] text-slate-400">{svc.detail}</span>
                    </div>
                  </div>
                  <Badge variant={svc.good ? 'success' : 'warning'} className="text-[10px]">{svc.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUB-VIEW: MASTER USER DIRECTORY (/admin/users) */}
      {/* ========================================================================= */}
      {isUsersView && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search users by name, email, role..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
              {(['All', 'Patient', 'Doctor', 'Hospital', 'Lab', 'Insurance', 'Administrator'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setUserRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                    userRoleFilter === r
                      ? 'bg-slate-900 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
              <Button
                variant="primary"
                size="sm"
                onClick={() => setAddUserModalOpen(true)}
                className="text-xs font-bold ml-2 shrink-0"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Add User</span>
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden p-0 border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold text-[10px] tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>
                        <span>{u.name}</span>
                        <span className="text-[10px] text-slate-400 block font-normal">{u.email}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="neutral" className="text-[10px] font-bold">
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{u.organization}</td>
                    <td className="py-3.5 px-4">
                      <Badge variant={u.status === 'Active' ? 'success' : 'danger'} className="text-[10px]">
                        {u.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{u.lastActivity}</td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant={u.status === 'Active' ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => setSelectedUserToDisable(u)}
                        className="text-xs px-2.5 py-1"
                      >
                        {u.status === 'Active' ? 'Disable' : 'Enable'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SUB-VIEW: HEALTHCARE ORGANIZATIONS (/admin/orgs) */}
      {/* ========================================================================= */}
      {isOrgsView && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <SearchBox value={orgSearch} onChange={setOrgSearch} placeholder="Search by name, type, district or registration" />
            <Button variant="primary" size="sm" onClick={() => setOrgModal(true)} className="text-xs font-bold">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add organisation
            </Button>
          </div>
          <SimpleTable headers={['Organisation', 'Type', 'Registration no.', 'Location', 'Status', '']} count={shownOrgs.length} empty="No organisations match your search. Try another name, or add one.">
            {shownOrgs.map((org) => (
              <tr key={org.id} className="hover:bg-slate-50/60">
                <td className="py-3 px-4">
                  <span className="font-bold text-slate-900 block">{org.name}</span>
                  <span className="text-[11px] text-slate-400">Added {formatDate(org.createdAt)}</span>
                </td>
                <td className="py-3 px-4 text-slate-700">{org.type}</td>
                <td className="py-3 px-4 font-mono text-slate-600">{org.registrationNo || '–'}</td>
                <td className="py-3 px-4 text-slate-600">
                  {[org.district, org.country].filter(Boolean).join(', ')}
                  {org.phone && <span className="block text-[11px] text-slate-400">{org.phone}</span>}
                </td>
                <td className="py-3 px-4">
                  <StatusBadge status={org.verified ? 'Verified' : 'Not verified'} />
                </td>
                <td className="py-3 px-4 text-right">
                  <Button variant="outline" size="sm" className="text-xs px-2.5 py-1" onClick={() => verifyOrg(org, !org.verified)}>
                    {org.verified ? 'Remove verification' : 'Mark verified'}
                  </Button>
                </td>
              </tr>
            ))}
          </SimpleTable>
          <Modal isOpen={orgModal} onClose={() => setOrgModal(false)} title="Add an organisation" maxWidth="md">
            <form onSubmit={addOrg} className="space-y-4">
              <Field label="Name" required value={newOrg.name} onChange={(v) => setNewOrg({ ...newOrg, name: v })} />
              <div className="grid grid-cols-2 gap-4">
                <SelectField label="Type" value={newOrg.type} onChange={(v) => setNewOrg({ ...newOrg, type: v })} options={['Hospital', 'Clinic', 'Laboratory', 'Insurance', 'Pharmacy']} />
                <SelectField label="Country" value={newOrg.country} onChange={(v) => setNewOrg({ ...newOrg, country: v })} options={['Nepal', 'India']} />
                <Field label="Registration number" value={newOrg.registrationNo} onChange={(v) => setNewOrg({ ...newOrg, registrationNo: v })} />
                <Field label="District or city" value={newOrg.district} onChange={(v) => setNewOrg({ ...newOrg, district: v })} />
              </div>
              <Field label="Phone" placeholder="+977 1 4XXXXXX" value={newOrg.phone} onChange={(v) => setNewOrg({ ...newOrg, phone: v })} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOrgModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={orgBusy}>
                  {orgBusy ? 'Saving…' : 'Add organisation'}
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SUB-VIEW: PERMISSIONS & RBAC MATRIX (/admin/permissions) */}
      {/* ========================================================================= */}
      {isPermissionsView && (
        <div className="space-y-4 animate-fade-in">
          <SimpleTable headers={['Account', 'Can see', 'Can add', 'Can decide']} count={PERMISSION_RULES.length} empty="">
            {PERMISSION_RULES.map((r) => (
              <tr key={r.role}>
                <td className="py-3 px-4 font-bold text-slate-900">{r.role}</td>
                <td className="py-3 px-4 text-slate-700">{r.see}</td>
                <td className="py-3 px-4 text-slate-700">{r.add}</td>
                <td className="py-3 px-4 text-slate-700">{r.decide}</td>
              </tr>
            ))}
          </SimpleTable>
          <p className="text-xs text-slate-500">These rules are built into the server. Every attempt to open a report is written to the activity history.</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SUB-VIEW: SECURITY OPERATIONS CENTER (/admin/security) */}
      {/* ========================================================================= */}
      {isSecurityView && (
        <div className="space-y-6 animate-fade-in">
          {securityError && (
            <div role="alert" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              {securityError}
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Failed sign-ins', value: security?.failedSignIns, note: `Last ${security?.days ?? 30} days`, warn: (security?.failedSignIns ?? 0) > 0 },
              { label: 'Accounts locked', value: security?.lockouts, note: 'After too many wrong passwords', warn: (security?.lockouts ?? 0) > 0 },
              { label: 'Changed files found', value: security?.tamperAlerts, note: 'Reports that failed a check', warn: (security?.tamperAlerts ?? 0) > 0 },
              { label: 'Disabled accounts', value: security?.disabledAccounts, note: `of ${security?.totalAccounts ?? '–'} accounts`, warn: false }
            ].map((c) => (
              <div key={c.label} className="p-4 bg-white rounded-2xl border border-slate-200">
                <span className="text-xs text-slate-500 font-bold block">{c.label}</span>
                <span className={`text-2xl font-black mt-1 block ${c.warn ? 'text-amber-600' : 'text-slate-900'}`}>
                  {c.value ?? '–'}
                </span>
                <span className="text-[11px] text-slate-400">{c.note}</span>
              </div>
            ))}
          </div>

          <Card className="p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Recent security events</h3>
            <p className="text-xs text-slate-500 mb-4">
              Wrong passwords, locked or disabled accounts, password changes and reports that failed a check. {security ? `${security.successfulSignIns} successful sign-ins in the same period.` : ''}
            </p>
            {security && security.recent.length === 0 && (
              <p className="text-xs text-slate-500">No security events in the last {security.days} days.</p>
            )}
            {security && security.recent.length > 0 && (
              <ul className="divide-y divide-slate-100 text-xs">
                {security.recent.map((ev, i) => (
                  <li key={`${ev.at}-${i}`} className="py-2.5 flex items-center justify-between gap-3">
                    <span className="text-slate-800">
                      <span className="font-semibold">{SECURITY_LABELS[ev.action] || ev.action}</span>
                      {ev.email ? ` · ${ev.email}` : ''}
                      {ev.reportId ? ` · report ${ev.reportId}` : ''}
                    </span>
                    <span className="text-slate-400 whitespace-nowrap">
                      {formatDateTime(ev.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SUB-VIEW: BLOCKCHAIN EXPLORER (/admin/blockchain) */}
      {/* ========================================================================= */}
      {isBlockchainView && (
        <div className="space-y-6 animate-fade-in">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-600" />
                  <span>Record history</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Each uploaded report adds an entry holding its fingerprint, linked to the entry before it.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={openBlocksModal} className="text-xs font-bold">
                Browse entries
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 my-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">Contract</span>
                {stats?.ledger?.contractAddress ? (
                  stats.ledger.chainId === 11155111 ? (
                    <a
                      href={`https://sepolia.etherscan.io/address/${stats.ledger.contractAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-bold text-sky-700 mt-1 block underline font-mono"
                    >
                      {stats.ledger.contractAddress.slice(0, 10)}…
                    </a>
                  ) : (
                    <span className="text-sm font-bold text-slate-900 mt-1 block font-mono">{stats.ledger.contractAddress.slice(0, 10)}…</span>
                  )
                ) : (
                  <span className="text-sm font-bold text-slate-900 mt-1 block">Not set up</span>
                )}
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">Entries</span>
                <span className="text-sm font-bold text-slate-900 mt-1 block">{stats?.totalBlocks ?? 0} entries</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">Changed files found</span>
                <span className={`text-sm font-bold mt-1 block ${(stats?.tamperAlerts ?? 0) > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                  {stats?.tamperAlerts ?? 0}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">Network</span>
                <span className="text-sm font-bold text-slate-900 mt-1 block">{stats?.networkStatus || '–'}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. SUB-VIEW: MASTER ACTIVITY AUDIT LOG (/admin/activity) */}
      {/* ========================================================================= */}
      {isActivityView && (
        <div className="space-y-6 animate-fade-in">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-600" />
                  <span>Activity</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sign-ins, reports opened, sharing changes and claims across every account.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={openActivityModal} className="text-xs font-semibold">
                Open full history
              </Button>
            </div>

            <LiveActivityTimeline accent="emerald" />
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. SUB-VIEW: MASTER SYSTEM SETTINGS (/admin/settings) */}
      {/* ========================================================================= */}
      {isSettingsView && (
        <div className="space-y-6 animate-fade-in">
          <ChangePasswordCard />
          <WalletCard />
          <ActiveSessionsCard />
          <Card className="p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-600" />
              <span>System settings</span>
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              These are set in the server's configuration file (<code>apps/server/.env</code>) and take effect when the server restarts.
              They cannot be changed from this page.
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                ['Demonstration mode', demoMode ? 'On – sample accounts are available (DEMO_ACCOUNTS)' : 'Off'],
                ['Record history', stats?.networkStatus || '–'],
                ['Blockchain contract', 'HEALTH_RECORDS_CONTRACT_ADDRESS'],
                ['Sign-in session length', 'JWT_EXPIRES_IN'],
                ['Wrong-password limit', 'MAX_FAILED_LOGINS and LOCKOUT_MINUTES'],
                ['Allowed web addresses', 'CLIENT_ORIGINS']
              ].map(([k, v]) => (
                <div key={k} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <dt className="text-[11px] font-bold text-slate-500">{k}</dt>
                  <dd className="mt-0.5 font-medium text-slate-900 break-words">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[11px] text-slate-500">
              Two-step sign-in (MFA) is not available yet.
            </p>
          </Card>
        </div>
      )}

      {/* MODAL: ADD USER */}
      <Modal isOpen={addUserModalOpen} onClose={() => setAddUserModalOpen(false)} title="Add an account">
        <form onSubmit={handleAddUser} className="space-y-4">
          {addUserError && (
            <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              {addUserError}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Anjali Koirala"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="r.chase@metrohospital.org"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Temporary Password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500"
            />
            <PasswordStrengthMeter password={newUserPassword} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">System Role</label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as any)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Patient">Patient</option>
                <option value="Doctor">Doctor</option>
                <option value="Hospital">Hospital</option>
                <option value="Lab">Lab</option>
                <option value="Insurance">Insurance</option>
                <option value="Administrator">Administrator</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Organization</label>
              <input
                type="text"
                value={newUserOrg}
                onChange={(e) => setNewUserOrg(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAddUserModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="text-xs font-bold">
              Create Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DIALOG: TOGGLE USER STATUS */}
      {selectedUserToDisable && (
        <ConfirmDialog
          isOpen={!!selectedUserToDisable}
          title={`${selectedUserToDisable.status === 'Active' ? 'Disable' : 'Enable'} Account`}
          message={`Are you sure you want to ${selectedUserToDisable.status === 'Active' ? 'disable' : 'enable'} access for ${selectedUserToDisable.name} (${selectedUserToDisable.email})?`}
          confirmLabel={selectedUserToDisable.status === 'Active' ? 'Disable Account' : 'Enable Account'}
          variant={selectedUserToDisable.status === 'Active' ? 'danger' : 'primary'}
          onConfirm={() => handleToggleUserStatus(selectedUserToDisable.id)}
          onCancel={() => setSelectedUserToDisable(null)}
        />
      )}
    </div>
  );
};
