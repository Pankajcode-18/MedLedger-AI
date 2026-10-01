import React, { useState } from 'react';
import { LanguagePicker } from '../components/common/LanguagePicker.js';
import { timeOfDayGreeting } from '../lib/activityFeed.js';
import { SampleDataBanner } from '../components/common/SampleDataBanner.js';
import { useLiveFeed } from '../hooks/useLiveFeed.js';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useUIStore } from '../store/uiStore.js';
import { Button } from '../components/common/Button.js';
import { NotificationDropdown } from '../components/layout/NotificationDropdown.js';
import { ActivityHistoryModal } from '../features/history/ActivityHistoryModal.js';
import { BlockchainExplorerModal } from '../features/blockchain/BlockchainExplorerModal.js';
import {
  ShieldCheck,
  TrendingUp,
  BarChart2,
  LayoutDashboard,
  FileText,
  KeyRound,
  History,
  Sparkles,
  Settings,
  LogOut,
  Menu,
  X,
  Layers,
  User,
  Bell,
  Search,
  Users,
  Building2,
  FlaskConical,
  Shield,
  Pill,
  Bed,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeVariant?: 'sky' | 'amber' | 'emerald';
}

export const DashboardLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');

  const { user, logout } = useAuthStore();
  const { openActivityModal, openBlocksModal, notifications } = useUIStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Keep notifications + activity trail in sync with the backend
  useLiveFeed();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getActiveRole = (): string => {
    const p = location.pathname.toLowerCase();
    if (p.startsWith('/doctor')) return 'doctor';
    if (p.startsWith('/hospital')) return 'hospital';
    if (p.startsWith('/lab')) return 'lab';
    if (p.startsWith('/insurance')) return 'insurance';
    if (p.startsWith('/admin')) return 'admin';
    if (p.startsWith('/patient')) return 'patient';
    return user?.role || 'patient';
  };

  const role = getActiveRole();

  // Role-specific customized sidebar navigation items per prompt requirements
  const getRoleNavItems = (): NavItem[] => {
    switch (role) {
      case 'patient':
        return [
          { name: 'Home', href: '/patient/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
          { name: 'My Records', href: '/patient/records', icon: <FileText className="w-4 h-4" /> },
          { name: 'Health & AI', href: '/patient/analytics', icon: <Sparkles className="w-4 h-4 text-sky-600" /> },
          { name: 'Sharing', href: '/patient/permissions', icon: <KeyRound className="w-4 h-4" /> },
          { name: 'Activity', href: '/patient/activity', icon: <History className="w-4 h-4" /> },
          { name: 'Notifications', href: '/patient/notifications', icon: <Bell className="w-4 h-4" />, badge: unreadCount || undefined, badgeVariant: 'amber' },
          { name: 'Settings', href: '/patient/settings', icon: <Settings className="w-4 h-4" /> }
        ];
      case 'doctor':
        return [
          { name: 'Dashboard', href: '/doctor/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
          { name: 'My Patients', href: '/doctor/patients', icon: <Users className="w-4 h-4" /> },
          { name: 'Medical Records', href: '/doctor/records', icon: <FileText className="w-4 h-4" /> },
          { name: 'Record requests', href: '/doctor/requests', icon: <KeyRound className="w-4 h-4" /> },
          { name: 'AI Assistant', href: '/doctor/ai', icon: <Sparkles className="w-4 h-4 text-sky-600" />, badge: 'AI', badgeVariant: 'sky' },
          { name: 'Prescriptions', href: '/doctor/medications', icon: <Pill className="w-4 h-4" /> },
          { name: 'Activity', href: '/doctor/activity', icon: <History className="w-4 h-4" /> },
          { name: 'Settings', href: '/doctor/settings', icon: <Settings className="w-4 h-4" /> }
        ];
      case 'hospital':
      case 'hospital-admin':
        return [
          { name: 'Dashboard', href: '/hospital/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
          { name: 'Patients', href: '/hospital/patients', icon: <Users className="w-4 h-4" /> },
          { name: 'Staff', href: '/hospital/staff', icon: <User className="w-4 h-4" /> },
          { name: 'Admissions', href: '/hospital/admissions', icon: <Bed className="w-4 h-4" /> },
          { name: 'Medical Records', href: '/hospital/records', icon: <FileText className="w-4 h-4" /> },
          { name: 'Prescriptions', href: '/hospital/prescriptions', icon: <Pill className="w-4 h-4" /> },
          { name: 'Activity', href: '/hospital/activity', icon: <History className="w-4 h-4" /> },
          { name: 'Settings', href: '/hospital/settings', icon: <Settings className="w-4 h-4" /> }
        ];
      case 'lab':
        return [
          { name: 'Dashboard', href: '/lab/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
          { name: 'Samples', href: '/lab/samples', icon: <FlaskConical className="w-4 h-4" /> },
          { name: 'Reports', href: '/lab/reports', icon: <FileText className="w-4 h-4" /> },
          { name: 'Upload a report', href: '/lab/upload', icon: <FileText className="w-4 h-4" /> },
          { name: 'Check a report', href: '/lab/verify', icon: <ShieldCheck className="w-4 h-4" /> },
          { name: 'Activity', href: '/lab/activity', icon: <History className="w-4 h-4" /> },
          { name: 'Settings', href: '/lab/settings', icon: <Settings className="w-4 h-4" /> }
        ];
      case 'insurance':
        return [
          { name: 'Dashboard', href: '/insurance/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
          { name: 'Claims', href: '/insurance/claims', icon: <Shield className="w-4 h-4" /> },
          { name: 'Check a document', href: '/insurance/verify', icon: <CheckCircle2 className="w-4 h-4" /> },
          { name: 'Policyholders', href: '/insurance/policyholders', icon: <Users className="w-4 h-4" /> },
          { name: 'Waiting for decision', href: '/insurance/pending', icon: <AlertCircle className="w-4 h-4" /> },
          { name: 'Activity', href: '/insurance/activity', icon: <History className="w-4 h-4" /> },
          { name: 'Settings', href: '/insurance/settings', icon: <Settings className="w-4 h-4" /> }
        ];
      case 'admin':
      case 'system-admin':
        return [
          { name: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
          { name: 'Users', href: '/admin/users', icon: <Users className="w-4 h-4" /> },
          { name: 'Organizations', href: '/admin/orgs', icon: <Building2 className="w-4 h-4" /> },
          { name: 'Permissions', href: '/admin/permissions', icon: <KeyRound className="w-4 h-4" /> },
          { name: 'Security', href: '/admin/security', icon: <Shield className="w-4 h-4" /> },
          { name: 'Record history', href: '/admin/blockchain', icon: <Layers className="w-4 h-4" /> },
          { name: 'Activity', href: '/admin/activity', icon: <History className="w-4 h-4" /> },
          { name: 'Settings', href: '/admin/settings', icon: <Settings className="w-4 h-4" /> }
        ];
      default:
        return [{ name: 'Home', href: '/patient/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> }];
    }
  };

  const navItems = getRoleNavItems();

  const formatName = (str?: string) => {
    if (!str) return 'User';
    return str
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  const ROLE_LABEL: Record<string, string> = {
    patient: 'Patient',
    doctor: 'Doctor',
    hospital: 'Hospital',
    'hospital-admin': 'Hospital',
    lab: 'Laboratory',
    insurance: 'Insurance',
    admin: 'Administrator',
    'system-admin': 'Administrator'
  };

  const SEARCH_HINT: Record<string, string> = {
    patient: 'Search your records',
    doctor: 'Search patients or reports',
    hospital: 'Search patients or staff',
    'hospital-admin': 'Search patients or staff',
    lab: 'Search samples',
    insurance: 'Search claims',
    admin: 'Search users or activity',
    'system-admin': 'Search users or activity'
  };
  const fullName = formatName(user?.name || '');
  const firstName = /^dr\.?\s/i.test(fullName) ? fullName : fullName.split(' ')[0];
  // the greeting lives here, in the header, so each page can start with a plain title
  const getRoleHeaderInfo = () => ({
    title: `${timeOfDayGreeting()}${firstName ? `, ${firstName}` : ''}`,
    subtitle: `${ROLE_LABEL[role] || 'MedLedger'} workspace`,
    searchPlaceholder: SEARCH_HINT[role] || 'Search'
  });

  const headerInfo = getRoleHeaderInfo();



  const getUserDisplayName = () => (user?.name ? formatName(user.name) : ROLE_LABEL[role] || 'User');

  const getUserOrg = () => ROLE_LABEL[role] || 'Account';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0 select-none">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-6 border-b border-slate-200">
          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center p-1">
            <img src="/logo.png" alt="MedLedger" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold text-slate-900 tracking-tight">MedLedger</span>
              <span className="bg-sky-100 text-sky-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded">AI</span>
            </div>
            <span className="text-[10px] text-slate-400 capitalize font-medium">
              {role.replace('-admin', '')} Workspace
            </span>
          </div>
        </div>

        {/* Role-Specific Nav Links */}
        <div className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.href ||
              (item.href !== '/patient/dashboard' &&
                item.href !== '/doctor/dashboard' &&
                item.href !== '/hospital/dashboard' &&
                item.href !== '/lab/dashboard' &&
                item.href !== '/insurance/dashboard' &&
                item.href !== '/admin/dashboard' &&
                location.pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      item.badgeVariant === 'amber'
                        ? 'bg-amber-100 text-amber-800'
                        : item.badgeVariant === 'emerald'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-sky-100 text-sky-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center text-xs font-bold text-sky-700 shrink-0">
                {getUserDisplayName()[0].toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-900 truncate">{getUserDisplayName()}</p>
                <p className="text-[10px] text-slate-500 capitalize">{role.replace('-admin', ' admin')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 shrink-0 sticky top-0 z-30 shadow-2xs">
          {/* Left: Title + Mobile Menu Button */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg focus:outline-none"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate">{headerInfo.title}</h2>
              <p className="text-[11px] text-slate-400 truncate hidden sm:block">{headerInfo.subtitle}</p>
            </div>
          </div>

          {/* Right: Search, Notifications, Activity, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Contextual Search */}
            <div className="relative hidden md:block w-52 lg:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={headerInfo.searchPlaceholder}
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium transition-colors"
              />
            </div>

            <LanguagePicker compact />

            {/* Notification Dropdown Bell with badge */}
            <NotificationDropdown />


            {/* Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors focus:outline-none"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                  {getUserDisplayName()[0].toUpperCase()}
                </div>
                <div className="text-left hidden lg:block leading-tight pr-1">
                  <span className="text-xs font-bold text-slate-900 block truncate max-w-[130px]">
                    {getUserDisplayName()}
                  </span>
                  <span className="text-[10px] text-slate-400 block capitalize">
                    {role.replace('-admin', ' Admin')}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden lg:block" />
              </button>

              {/* Dismissible Backdrop */}
              {profileDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-fade-in text-xs">
                    <div className="p-2 border-b border-slate-100">
                      <p className="font-bold text-slate-900 truncate">{getUserDisplayName()}</p>
                      <p className="text-[11px] text-slate-500 capitalize">{role.replace('-admin', ' Administrator')}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">{getUserOrg()}</p>
                    </div>

                    <Link
                      to={`/${role.replace('-admin', '')}/settings`}
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-medium"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Account Settings</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        openActivityModal();
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-medium text-left"
                    >
                      <History className="w-4 h-4 text-slate-400" />
                      <span>Activity</span>
                    </button>

                    {(role === 'admin' || role === 'system-admin') && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        openBlocksModal();
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-medium text-left"
                    >
                      <Layers className="w-4 h-4 text-slate-400" />
                      <span>Record history</span>
                    </button>
                    )}

                    <div className="pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-semibold text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <SampleDataBanner />
            {children || <Outlet />}
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative w-72 bg-white flex flex-col h-full shadow-2xl z-10 animate-fade-in">
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center p-1"><img src="/logo.png" alt="MedLedger" className="w-full h-full object-contain" /></div>
                <div>
                  <span className="font-bold text-slate-900 block text-sm">MedLedger AI</span>
                  <span className="text-[10px] text-slate-400 capitalize">{role.replace('-admin', '')} Portal</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              ))}

            </div>

            <div className="p-4 border-t border-slate-200 space-y-2">
              <div className="flex items-center gap-2.5 px-2">
                <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                  {getUserDisplayName()[0].toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <span className="font-bold text-slate-900 block text-xs truncate">{getUserDisplayName()}</span>
                  <span className="text-[10px] text-slate-500 capitalize">{role.replace('-admin', '')}</span>
                </div>
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={handleLogout}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modals: User Activity History & Technical Blockchain Verification */}
      <ActivityHistoryModal />
      <BlockchainExplorerModal />
    </div>
  );
};
