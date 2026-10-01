import { formatDayMonth, formatTime } from '../../lib/format.js';
import { PageHeader } from '../../components/common/PageKit.js';
import { usePatientConsent } from '../../hooks/useConsent.js';
import { PatientPermissions } from './PatientPermissions.js';
import React, { useState, useEffect, useRef } from 'react';
import { formatDate, recordTitle } from '../../lib/format.js';
import { useSavedSettings } from '../../hooks/useSavedSettings.js';
import { downloadEmergencyCard } from '../../lib/emergencyCard.js';
import { DemoBadge, DemoNote } from '../../components/common/DemoBadge.js';
import { PatientHealthTrends, PatientReportsExplained, PatientMedicationsPanel, LatestVitalsStrip } from '../ai/PatientAiPanels.js';
import { aiApi } from '../../api/aiApi.js';
import { ActiveSessionsCard } from '../../components/common/ActiveSessionsCard.js';
import { authApi } from '../../api/authApi.js';
import { validatePassword, apiErrorMessage } from '../../lib/password.js';
import { timeOfDayGreeting } from '../../lib/activityFeed.js';
import { LiveNotificationsList } from '../../components/common/LiveNotificationsList.js';
import { LiveActivityTimeline } from '../../components/common/LiveActivityTimeline.js';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';
import { useUIStore } from '../../store/uiStore.js';
import { recordsApi, recordErrorMessage } from '../../api/recordsApi.js';
import { WalletCard } from '../../components/common/WalletCard.js';
import { walletApi, WalletStatus } from '../../api/walletApi.js';
import { consentWithWallet } from '../../lib/walletConsent.js';
import { walletErrorMessage } from '../../lib/wallet.js';
import { consentApi } from '../../api/consentApi.js';
import { ChatSource, MedicalRecord, SavedChatMessage } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { Dropzone } from '../../components/common/Dropzone.js';
import { Modal } from '../../components/common/Modal.js';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.js';
import {
  FileText,
  KeyRound,
  Users,
  History,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Download,
  Eye,
  Search,
  Filter,
  UploadCloud,
  ChevronRight,
  Lock,
  Unlock,
  Clock,
  Sparkles,
  Shield,
  ArrowRight,
  XCircle,
  HelpCircle,
  Bell,
  Settings,
  Send,
  MessageSquare,
  Copy,
  Check,
  Phone,
  Mail,
  User,
  Save,
  HeartPulse,
  Activity,
  Plus,
  TrendingUp,
  TrendingDown,
  BarChart2,
  LineChart,
  PieChart,
  Info,
  Calendar,
  Pill,
  Stethoscope,
  ChevronDown,
  Share2,
  Printer,
  RefreshCw,
  Layers,
  ExternalLink,
  CheckCircle,
  HelpCircle as HelpIcon,
  ChevronLeft
} from 'lucide-react';

export const PatientDashboardPage: React.FC = () => {
  const { user, setAuth } = useAuthStore();
  const { openActivityModal } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Search & Filter state for records
  // Analytics, Charts & Report Deep-Dive States
  const [aiActiveTab, setAiActiveTab] = useState<'charts' | 'reports' | 'chat' | 'medications'>('charts');
  const [chartTimeframe, setChartTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedChartMetric, setSelectedChartMetric] = useState<'bp' | 'heart' | 'glucose' | 'spo2' | 'lipids'>('bp');
  const [selectedReportId, setSelectedReportId] = useState<string>('1593418802454');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customReportQuestion, setCustomReportQuestion] = useState('');
  const [reportAiAnswer, setReportAiAnswer] = useState<string | null>(null);
  const [reportAiLoading, setReportAiLoading] = useState(false);
  const chatGreeting = {
    id: 'm-init',
    sender: 'ai' as const,
    text: `Hello${user?.name ? ` ${user.name.split(' ')[0]}` : ''}! I can explain the values in your reports and readings, tell you how they have changed over time, explain your medicines, and suggest questions for your next doctor visit. What would you like to know?`,
    time: ''
  };
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: 'user' | 'ai'; text: string; time: string; sources?: ChatSource[] }>>([
    chatGreeting
  ]);
  const toChatBubble = (m: SavedChatMessage) => ({
    id: m.id,
    sender: m.role === 'user' ? ('user' as const) : ('ai' as const),
    text: m.content,
    time: `${formatDayMonth(m.createdAt)}, ${formatTime(m.createdAt)}`,
    sources: m.sources
  });

  // The conversation is saved on the server (encrypted), so it survives reloads and devices
  useEffect(() => {
    let cancelled = false;
    aiApi
      .chatHistory()
      .then((msgs) => {
        if (!cancelled && msgs.length) setChatMessages([chatGreeting, ...msgs.map(toChatBubble)]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // keep the newest message in view
  const chatScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  const handleNewConversation = async () => {
    try {
      await aiApi.clearChat();
    } catch {
      /* keep the local reset even if the server call fails */
    }
    setChatMessages([chatGreeting]);
    setAiAnswer(null);
  };

  // Settings & Security State
  const [settingsActiveTab, setSettingsActiveTab] = useState<'profile' | 'security' | 'notifications' | 'data'>('profile');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwChangeLoading, setPwChangeLoading] = useState(false);
  const [pwChangeSuccess, setPwChangeSuccess] = useState<string | null>(null);
  const [pwChangeError, setPwChangeError] = useState<string | null>(null);

  // Forgot password state
  const [forgotEmailInput, setForgotEmailInput] = useState(user?.email || '');
  const [forgotLinkSent, setForgotLinkSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotDevLink, setForgotDevLink] = useState<string | null>(null);

  // 2FA state

  // Notifications preferences
  const { values: notifPreferences, setValues: setNotifPreferences, save: saveNotifPreferences } = useSavedSettings('notifications', {
    doctorAccessAlerts: true,
    newReportAlerts: true,
    criticalVitalsAlerts: true,
    monthlyDigest: false
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<
    'All' | 'Blood Tests' | 'Imaging' | 'Prescriptions' | 'Doctor Notes'
  >('All');

  // Upload personal record state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [reportTitle, setReportTitle] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Record preview modal state
  const [previewRecord, setPreviewRecord] = useState<MedicalRecord | null>(null);

  // Patient AI Assistant state (/patient/ai)
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Settings state (/patient/settings)
  const { values: patientProfile, setValues: setPatientProfile, save: savePatientProfile, saving: savingProfile } = useSavedSettings('profile', {
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    age: '',
    bloodGroup: '',
    address: '',
    allergies: '',
    emergencyContactName: '',
    emergencyContactPhone: ''
  });

  const formatName = (str?: string) => {
    if (!str) return 'Tanmay Shishodia';
    return str
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  const patientId = user?.userId || '90';
  const patientName = formatName(patientProfile.name);

  // Detect current active subroute from URL pathname & search parameters
  const path = location.pathname.toLowerCase();
  const searchParams = new URLSearchParams(location.search);
  const tabQuery = searchParams.get('tab');
  const reportQuery = searchParams.get('reportId');

  const isRecordsView = path.includes('/records');
  const isPermissionsView = path.includes('/permissions');
  const isChartsView = path.includes('/charts');
  const isReportsAnalysisView = path.includes('/reports');
  const isAiView = path.includes('/ai') || path.includes('/analytics') || isChartsView || isReportsAnalysisView || path.includes('/medications');
  const isActivityView = path.includes('/activity');
  const isNotificationsView = path.includes('/notifications');
  const isSettingsView = path.includes('/settings');
  const isHomeView =
    !isRecordsView &&
    !isPermissionsView &&
    !isAiView &&
    !isActivityView &&
    !isNotificationsView &&
    !isSettingsView;

  // Sync route and query params to active tab
  useEffect(() => {
    if (tabQuery === 'reports' || path.includes('/reports')) {
      setAiActiveTab('reports');
    } else if (tabQuery === 'chat' || tabQuery === 'companion') {
      setAiActiveTab('chat');
    } else if (tabQuery === 'medications' || path.includes('/medications')) {
      setAiActiveTab('medications');
    } else {
      setAiActiveTab('charts');
    }

    if (reportQuery) {
      setSelectedReportId(reportQuery);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    loadData();
  }, [patientId]);

  // Who can see the records: one answer from the server, shared by every part of this page
  const consent = usePatientConsent((text) => setToast(text));
  const sharedNames = consent.granted.map((g) => g.doctorName);
  const sharedLabel =
    sharedNames.length === 0 ? 'Only you' : sharedNames.length === 1 ? `Shared with ${sharedNames[0]}` : `Shared with ${sharedNames.length} doctors`;

  const loadData = async () => {
    setLoading(true);
    try {
      setRecords(await recordsApi.getRecords());
      consent.refresh();
    } catch (e) {
      console.error('Failed to load patient data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (record: MedicalRecord) => {
    try {
      const v = await recordsApi.verifyRecord(record.reportId);
      if (v.verified) {
        setToast(
          `Unchanged since upload ✓ — ${recordTitle(record)} opens correctly and matches the copy you uploaded.`
        );
      } else {
        setToast(v.problem || 'This record could not be verified.');
      }
    } catch (e) {
      setToast(await recordErrorMessage(e));
    }
  };

  const handleDownload = (record: MedicalRecord) => {
    if (record.isSample) {
      setToast('This older record only has a summary; the original file was not kept. Upload the report again to keep a copy.');
      return;
    }
    recordsApi.downloadRecord(record.reportId, record.fileName).catch((e: Error) => setToast(e.message));
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile && !clinicalNotes) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      if (uploadFile) formData.append('file', uploadFile);
      formData.append('patientId', patientId);
      formData.append('clinicalNotes', clinicalNotes || 'Personal medical document.');
      formData.append('reportTitle', reportTitle || uploadFile?.name || 'Personal Health Record');

      await recordsApi.uploadRecord(formData);
      setToast('Your report is saved and locked. Only you, and doctors you share with, can open it.');
      setUploadFile(null);
      setReportTitle('');
      setClinicalNotes('');
      setShowUploadForm(false);
      loadData();
    } catch (e) {
      setToast(await recordErrorMessage(e));
    } finally {
      setIsUploading(false);
    }
  };

  const handleAskAi = async (promptText: string) => {
    if (!promptText || !promptText.trim()) return;
    setAiLoading(true);
    setAiActiveTab('chat');

    const userMsgId = 'u-' + Date.now();
    const currentChat = [
      ...chatMessages,
      { id: userMsgId, sender: 'user' as const, text: promptText, time: 'Just now' }
    ];
    setChatMessages(currentChat);
    setAiQuestion('');

    // Real answer from the AI module, grounded in this patient's records and readings.
    // Only the new question is sent; the server keeps the conversation history.
    try {
      const res = await aiApi.ask(promptText);
      setAiAnswer(res.reply);
      setChatMessages((prev) => [
        ...prev.filter((m) => m.id !== userMsgId),
        ...(res.messages.length
          ? res.messages.map(toChatBubble)
          : [
              { id: userMsgId, sender: 'user' as const, text: promptText, time: 'Just now' },
              { id: 'ai-' + Date.now(), sender: 'ai' as const, text: res.reply, time: 'Just now', sources: res.sources }
            ])
      ]);
    } catch (err) {
      const reply =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Sorry, the assistant is unavailable right now. Please try again in a moment.';
      setAiAnswer(reply);
      setChatMessages((prev) => [...prev, { id: 'ai-' + Date.now(), sender: 'ai' as const, text: reply, time: 'Just now' }]);
    }
    setAiLoading(false);
  };

  // Filter records
  const filteredRecords = records.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      r.fileName?.toLowerCase().includes(q) ||
      r.report?.toLowerCase().includes(q) ||
      r.reportId?.includes(q);

    let matchesCategory = true;
    if (categoryFilter === 'Blood Tests')
      matchesCategory =
        r.fileName.toLowerCase().includes('hp') ||
        r.fileName.toLowerCase().includes('blood') ||
        r.report?.toLowerCase().includes('blood') ||
        false;
    else if (categoryFilter === 'Imaging')
      matchesCategory =
        r.fileName.toLowerCase().includes('xray') ||
        r.fileName.toLowerCase().includes('radiology') ||
        r.fileName.toLowerCase().includes('mri');
    else if (categoryFilter === 'Prescriptions')
      matchesCategory =
        r.fileName.toLowerCase().includes('rx') ||
        r.fileName.toLowerCase().includes('cetirizine') ||
        r.report?.toLowerCase().includes('prescription') ||
        false;
    else if (categoryFilter === 'Doctor Notes')
      matchesCategory =
        r.fileName.toLowerCase().includes('consultation') ||
        r.report?.toLowerCase().includes('consultation') ||
        false;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Toast Banner */}
      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs sm:text-sm animate-fade-in shadow-xs">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toast}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold p-1"
          >
            &times;
          </button>
        </div>
      )}

      {/* =========================================================================
          SUB-ROUTE 1: HOME / OVERVIEW (/patient/dashboard or /patient)
         ========================================================================= */}
      {isHomeView && (
        <div className="space-y-6 animate-fade-in font-sans">
          
          {/* 1. TOP PATIENT PROFILE BANNER */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-xl shadow-sm shrink-0">
                {patientName.charAt(0)}
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1220] tracking-tight">
                    Home
                  </h1>
                </div>
                <div className="flex items-center gap-x-3 gap-y-0.5 text-xs text-[#64748B] flex-wrap">
                  <span>{patientName}</span>
                  <span className="hidden sm:inline" aria-hidden="true">&bull;</span>
                  <span>Blood group: <strong className="text-slate-800">{patientProfile.bloodGroup || 'not added'}</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => navigate('/patient/analytics')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 rounded-xl shadow-xs transition-all"
              >
                <Sparkles className="w-4 h-4 text-sky-200" />
                <span>Health &amp; AI</span>
              </button>
              <button
                type="button"
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all"
              >
                <UploadCloud className="w-4 h-4 text-blue-600" />
                <span>{showUploadForm ? 'Cancel' : 'Upload a report'}</span>
              </button>
            </div>
          </div>

          {/* 2. HEALTH VITALS STRIP — latest real values from reports and home readings */}
          <LatestVitalsStrip onAdd={() => navigate('/patient/analytics?tab=charts&add=1')} />

          {/* 3. PLATFORM SUMMARY METRICS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div
              onClick={() => navigate('/patient/records')}
              className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Medical Records</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl font-extrabold text-[#0B1220] block">
                {records.length}
              </span>
              <span className="text-xs text-blue-600 font-medium block">
                Locked – only you and people you allow
              </span>
            </div>

            <div
              onClick={() => navigate('/patient/permissions')}
              className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Requests</span>
                <div className={'w-8 h-8 rounded-xl flex items-center justify-center ' + (
                  consent.pending.length ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                )}>
                  <KeyRound className="w-4 h-4" />
                </div>
              </div>
              <span className={'text-2xl font-extrabold block ' + (
                consent.pending.length ? 'text-amber-600' : 'text-[#0B1220]'
              )}>
                {consent.summary.pendingRequests ?? consent.pending.length}
              </span>
              <span className="text-xs text-amber-600 font-medium block">
                {consent.pending.length ? 'Waiting for your answer' : 'Nothing to answer'}
              </span>
            </div>

            <div
              onClick={() => navigate('/patient/permissions')}
              className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Doctors who can see them</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl font-extrabold text-[#0B1220] block">
                {consent.summary.doctorsWithAccess ?? consent.granted.length}
              </span>
              <span className="text-xs text-emerald-600 font-medium block">
                {sharedNames.length ? sharedNames.slice(0, 2).join(', ') : 'Not shared with anyone'}
              </span>
            </div>

            <div
              onClick={() => navigate('/patient/records')}
              className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Protected files</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl font-extrabold text-[#0B1220] block">{records.filter((r) => r.fileHash && !r.isSample).length}</span>
              <span className="text-xs text-indigo-600 font-medium block">
                Checked for changes
              </span>
            </div>
          </div>

          {/* 4. DOCTORS WAITING FOR AN ANSWER */}
          {consent.pending.slice(0, 3).map((req) => (
            <div key={req.doctorId} className="p-5 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0B1220]">{req.doctorName} asked to see your records</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {req.reason ? `“${req.reason}” · ` : ''}You decide — you can stop sharing at any time.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => consent.act('decline', req.doctorId)}
                  disabled={Boolean(consent.busy)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => consent.act('grant', req.doctorId)}
                  disabled={Boolean(consent.busy)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Share my records</span>
                </button>
              </div>
            </div>
          ))}

          {/* Quick Upload Form Modal/Card (if toggled) */}
          {showUploadForm && (
            <Card className="p-6 border-2 border-blue-300 bg-blue-50/20 rounded-2xl animate-fade-in">
              <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-600" />
                <span>Upload Personal Medical File</span>
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Your file is locked as soon as it reaches MedLedger. Only you, and doctors you share with, can open it.
              </p>

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Document Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Previous Blood Test or Vaccine Record"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Doctor Notes / Description</label>
                  <textarea
                    rows={2}
                    placeholder="Add any notes about this medical document..."
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <Dropzone
                    onFileSelect={(f) => setUploadFile(f)}
                    accept=".pdf,.docx,.jpg,.png"
                    label="Drop a report here (PDF, Word or photo), or click to choose one"
                  />
                  {uploadFile && (
                    <div className="mt-2 text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ready to upload: {uploadFile.name}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowUploadForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" isLoading={isUploading} className="text-xs font-bold">
                    Upload report
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* 5. TWO-COLUMN MAIN WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left 8 Columns: Health Records Vault & AI Assistant */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Health Records Vault */}
              <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-[#0B1220] tracking-tight">
                      My records
                    </h2>
                    <p className="text-xs text-[#64748B]">
                      Every report is locked when it is saved. Only you, and doctors you choose, can open it.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/patient/records')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <span>View All ({records.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {records.slice(0, 3).map((rec) => (
                    <div
                      key={rec.reportId}
                      className="p-4 rounded-xl border border-slate-200/90 bg-[#F7FAFC] hover:bg-white hover:border-blue-300 hover:shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 truncate">
                              {recordTitle(rec)}
                            </h4>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Locked
                            </span>
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              {sharedLabel}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                            {rec.report ? <span translate="no">{rec.report}</span> : 'No summary for this report yet.'}
                          </p>

                          <div className="flex items-center gap-2.5 text-[11px] text-[#64748B] mt-1.5 font-medium">
                            <span>{rec.uploadedBy === patientId ? 'You' : rec.uploaderName || 'Your care team'}</span>
                            <span>&bull;</span>
                            <span>{formatDate(rec.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownload(rec)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 text-blue-600" />
                          <span>Download</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigate('/patient/ai');
                            handleAskAi('Explain my blood test results');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                          <span>Explain</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* AI health assistant Section */}
              <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#0B1220]">AI health assistant</h3>
                      <p className="text-xs text-[#64748B]">Ask medical questions in plain English about your reports</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    Personal details removed
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    'Explain my blood test results',
                    'What was my latest blood pressure?',
                    'Are there precautions with Cetirizine?',
                    'Questions for my next doctor visit'
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleAskAi(chip)}
                      className="text-xs bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 px-3 py-2 rounded-xl border border-slate-200 hover:border-blue-300 font-medium transition-all text-left flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3 text-blue-500" />
                      <span>{chip}</span>
                    </button>
                  ))}
                </div>

                {aiLoading && (
                  <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-blue-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Analyzing your electronic health records securely...</span>
                  </div>
                )}

                {aiAnswer && !aiLoading && (
                  <div className="p-4 rounded-xl bg-[#F7FAFC] border border-slate-200 space-y-2 text-xs animate-fade-in">
                    <div className="flex items-center justify-between text-slate-400 font-mono text-[10px]">
                      <span>Prompt: {aiQuestion}</span>
                      <span className="text-emerald-600 font-bold">✓ Verified Against Records</span>
                    </div>
                    <p className="text-slate-800 leading-relaxed">{aiAnswer}</p>
                    <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-100">
                      AI supports healthcare professionals and patient understanding. It does not replace medical advice.
                    </p>
                  </div>
                )}
              </section>

            </div>

            {/* Right 4 Columns: Care Team, Emergency ID, Activity */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Care Team */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-[#0B1220]">Your Care Team</h3>
                  <button
                    type="button"
                    onClick={() => navigate('/patient/permissions')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    Change sharing
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  {[...consent.granted, ...consent.pending].length === 0 ? (
                    <p className="text-slate-500">No doctor can see your records. When a doctor asks, you will see it here.</p>
                  ) : (
                    [...consent.granted, ...consent.pending].map((e) => (
                      <div key={e.doctorId} className="p-3 rounded-xl bg-[#F7FAFC] border border-slate-200/70 flex items-center justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-900">{e.doctorName}</h4>
                          <span className="text-[11px] text-[#64748B] block">{e.doctor?.specialty || 'Doctor'}</span>
                        </div>
                        {e.status === 'granted' ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Can see your records
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Waiting for your answer
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Emergency Health Card */}
              <div className="p-5 rounded-2xl bg-white border border-rose-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-rose-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center text-xs font-bold">
                      +
                    </div>
                    <h3 className="text-xs font-bold text-rose-950 tracking-wide">
                      Emergency details
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/patient/settings')}
                    className="text-[10px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded hover:bg-rose-100"
                  >
                    Edit
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Blood Group:</span>
                    <span className="font-bold text-[#111827]">{patientProfile.bloodGroup || 'Not added'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Allergies:</span>
                    <span className="font-semibold text-[#111827]">{patientProfile.allergies || 'Not added'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Emergency Contact:</span>
                    <span className="font-medium text-[#111827]">{patientProfile.emergencyContactName || 'Not added'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Direct Phone:</span>
                    <span className="font-mono font-bold text-[#111827]">{patientProfile.emergencyContactPhone || 'Not added'}</span>
                  </div>
                </div>
              </div>

              {/* Recent Activity Feed */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-[#0B1220]">Recent activity</h3>
                  <button
                    type="button"
                    onClick={openActivityModal}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    See all activity
                  </button>
                </div>

                <LiveActivityTimeline accent="emerald" limit={4} />
              </div>

            </div>

          </div>

        </div>
      )}

      {/* =========================================================================
          SUB-ROUTE 2: MY RECORDS (/patient/records)
         ========================================================================= */}
      {isRecordsView && (
        <div className="space-y-6 animate-fade-in font-sans">
          
          {/* Header & Vault Summary Strip */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B1220] tracking-tight">
                  My records
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                Every report is locked when it is saved, and we can check it has not been changed since.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Upload a report</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 tracking-wider block">Reports</span>
              <span className="text-2xl font-extrabold text-[#0B1220]">{records.length}</span>
              <span className="text-xs text-blue-600 font-medium block">Only you and people you allow can open them</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 tracking-wider block">Protection</span>
              <span className="text-lg font-extrabold text-emerald-700 block">Locked</span>
              <span className="text-xs text-slate-500 font-medium block">Authenticated Cipher</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 tracking-wider block">Integrity Proofs</span>
              <span className="text-lg font-extrabold text-indigo-700 block">Fingerprinted</span>
              <span className="text-xs text-slate-500 font-medium block">Fingerprint taken at upload</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 tracking-wider block">Access Status</span>
              <span className="text-lg font-extrabold text-slate-900 block">{sharedNames.length ? `${sharedNames.length} doctor${sharedNames.length === 1 ? '' : 's'}` : 'Private'}</span>
              <span className="text-xs text-emerald-600 font-medium block">{sharedNames.length ? sharedLabel : 'Only you can see them'}</span>
            </div>
          </div>

          {/* Search, Filter & Toolbar Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search file name, test, provider, or clinical notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Category Filter Pills with Badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
              {[
                { name: 'All', count: records.length },
                { name: 'Blood Tests', count: records.filter(r => (r.fileName || '').toLowerCase().includes('hp') || (r.fileName || '').toLowerCase().includes('blood') || (r.fileName || '').toLowerCase().includes('lipid') || (r.fileName || '').toLowerCase().includes('glucose') || (r.report || '').toLowerCase().includes('blood') || (r.report || '').toLowerCase().includes('cholesterol')).length },
                { name: 'Imaging', count: records.filter(r => (r.fileName || '').toLowerCase().includes('radiology') || (r.fileName || '').toLowerCase().includes('chest') || (r.fileName || '').toLowerCase().includes('mri') || (r.report || '').toLowerCase().includes('radiograph')).length },
                { name: 'Prescriptions', count: records.filter(r => (r.fileName || '').toLowerCase().includes('rx') || (r.fileName || '').toLowerCase().includes('cetirizine') || (r.fileName || '').toLowerCase().includes('salbutamol')).length },
                { name: 'Doctor Notes', count: records.filter(r => (r.fileName || '').toLowerCase().includes('note') || (r.fileName || '').toLowerCase().includes('consultation') || (r.fileName || '').toLowerCase().includes('ecg') || (r.uploadedBy || '').includes('Dr.')).length }
              ].map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setCategoryFilter(item.name as any)}
                  className={'px-3 py-1.5 rounded-xl whitespace-nowrap text-xs font-semibold flex items-center gap-1.5 transition-all ' + (
                    categoryFilter === item.name
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  )}
                >
                  <span>{item.name}</span>
                  <span className={'text-[10px] px-1.5 py-0.2 rounded-full ' + (
                    categoryFilter === item.name ? 'bg-white/20 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  )}>
                    {item.count}
                  </span>
                </button>
              ))}
            </div>

          </div>

          {/* Quick Upload Form (if toggled) */}
          {showUploadForm && (
            <Card className="p-6 border-2 border-blue-300 bg-blue-50/20 rounded-2xl animate-fade-in">
              <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-600" />
                <span>Upload Personal Medical File</span>
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Your file is locked as soon as it reaches MedLedger. Only you, and doctors you share with, can open it.
              </p>

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Document Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Previous Blood Test, MRI scan, or Vaccine Record"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Doctor Notes / Description</label>
                  <textarea
                    rows={2}
                    placeholder="Add clinical context or diagnostic notes..."
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <Dropzone
                    onFileSelect={(f) => setUploadFile(f)}
                    accept=".pdf,.docx,.jpg,.png"
                    label="Drop a report here (PDF, Word or photo), or click to choose one"
                  />
                  {uploadFile && (
                    <div className="mt-2 text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ready to upload: {uploadFile.name}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowUploadForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" isLoading={isUploading} className="text-xs font-bold">
                    Upload report
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* 3-Column Responsive Records Grid */}
          {filteredRecords.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRecords.map((r) => {
                const isBlood = (r.fileName || '').toLowerCase().includes('blood') || (r.fileName || '').toLowerCase().includes('hp') || (r.fileName || '').toLowerCase().includes('lipid') || (r.fileName || '').toLowerCase().includes('glucose');
                const isImaging = (r.fileName || '').toLowerCase().includes('radiology') || (r.fileName || '').toLowerCase().includes('chest') || (r.fileName || '').toLowerCase().includes('mri');
                const isRx = (r.fileName || '').toLowerCase().includes('rx') || (r.fileName || '').toLowerCase().includes('cetirizine') || (r.fileName || '').toLowerCase().includes('salbutamol');
                
                const categoryLabel = isBlood ? 'Blood Test' : isImaging ? 'Imaging & Scan' : isRx ? 'Prescription' : 'Doctor Notes';
                const categoryBadgeStyle = isBlood
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : isImaging
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : isRx
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200';

                const formattedSize = r.fileSize ? (r.fileSize > 1000000 ? (r.fileSize / 1000000).toFixed(2) + ' MB' : (r.fileSize / 1000).toFixed(1) + ' KB') : '48 KB';

                return (
                  <div
                    key={r.reportId}
                    className="p-5 bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      {/* Top Header Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ' + categoryBadgeStyle}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 text-sm truncate group-hover:text-blue-600 transition-colors" title={r.fileName}>
                              {recordTitle(r)}
                            </h3>
                            <span className="text-[11px] text-slate-400 block truncate">
                              {formatDate(r.createdAt)}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                          Locked
                        </span>
                      </div>

                      {/* Badges Row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={'text-[10px] font-semibold px-2 py-0.5 rounded-md border ' + categoryBadgeStyle}>
                          {categoryLabel}
                        </span>
                        <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {sharedLabel}
                        </span>
                        {r.fileAvailable ? (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200"
                            title="Stored locked; only you and people you allow can open it"
                          >
                            Locked
                          </span>
                        ) : r.isSample ? (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-slate-50 text-slate-500 border-slate-200"
                            title="Example record shown for demonstration — not stored on the server"
                          >
                            Example
                          </span>
                        ) : r.fileAvailable === false ? (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-amber-50 text-amber-700 border-amber-200"
                            title="This older record was added before files were kept; only its summary is stored."
                          >
                            Summary only
                          </span>
                        ) : null}
                      </div>

                      {/* Report Clinical Summary */}
                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed bg-[#F8FAFC] p-2.5 rounded-xl border border-slate-100">
                        {r.report ? <span translate="no">{r.report}</span> : 'No summary for this report.'}
                      </p>

                      {/* Metadata Table */}
                      <div className="space-y-1 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Added by:</span>
                          <span className="font-medium text-slate-700 truncate max-w-[170px]">
                            {r.uploadedBy === patientId ? 'You' : r.uploaderName || 'Your care team'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Date:</span>
                          <span className="text-slate-700">
                            {formatDate(r.createdAt)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Size:</span>
                          <span className="font-mono text-slate-600">{formattedSize}</span>
                        </div>
                      </div>

                      {/* Check for changes */}
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/70 flex items-center justify-between text-[10px] font-mono text-slate-500">
                        <span className="truncate">
                          Fingerprint {r.fileHash ? r.fileHash.replace(/^0x/, '').substring(0, 10) + '…' : '–'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(r.fileHash || '');
                            setToast('File fingerprint copied. Share it with anyone who needs to check this report has not been changed.');
                          }}
                          className="text-blue-600 hover:text-blue-700 font-bold ml-1"
                          title="Copy the file fingerprint"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {r.fileAvailable && (
                          <button
                            type="button"
                            onClick={() => handleVerify(r)}
                            className="text-emerald-700 hover:text-emerald-900 font-bold ml-1 inline-flex items-center gap-0.5 font-sans"
                            title="Check that the stored file is intact and matches this fingerprint"
                          >
                            <ShieldCheck className="w-3 h-3" /> Check
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownload(r)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                        <span>Download</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReportId(r.reportId);
                          setAiActiveTab('reports');
                          navigate(`/patient/analytics?tab=reports&reportId=${r.reportId}`);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>AI Explain</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No medical records match your search</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No files found under category "{categoryFilter}" with query "{searchQuery}". Try adjusting your filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('All');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Reset Filters
              </button>
            </div>
          )}

        </div>
      )}

      {/* =========================================================================
          SUB-ROUTE 3: ACCESS & PERMISSIONS (/patient/permissions)
         ========================================================================= */}
      {isPermissionsView && (
        <div className="space-y-6 animate-fade-in font-sans pb-12 max-w-5xl mx-auto">
          <PageHeader tag={patientName} title="Sharing" subtitle="Choose which doctors can see your records, and answer their requests." />
          <PatientPermissions consent={consent} />
        </div>
      )}

      {/* =========================================================================
          SUB-ROUTE 4: PATIENT HEALTH INSIGHTS & REPORTS HUB (CLEAN & USER-FRIENDLY)
         ========================================================================= */}
      {isAiView && (
        <div className="space-y-6 animate-fade-in font-sans pb-12 max-w-6xl mx-auto">
          
          {/* 1. Welcoming, Clean Header Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Patient Health Hub</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Health Insights &amp; Reports
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-normal">
                  Track your vitals over time, understand your test reports in plain English, and ask questions about your health.
                </p>
              </div>

              {/* Quiet Safety Status Tag */}
              <div className="flex items-center gap-2 self-start sm:self-auto px-3.5 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shrink-0">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Personal details are removed before AI analysis</span>
              </div>
            </div>

            {/* Clean Segmented Navigation Control */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              {[
                { id: 'charts', label: 'Health Trends & Vitals', icon: TrendingUp },
                { id: 'reports', label: 'My Test Reports Explained', icon: FileText, badge: `${records.length} Report${records.length === 1 ? '' : 's'}` },
                { id: 'chat', label: 'Ask AI Assistant', icon: Sparkles },
                { id: 'medications', label: 'My Medications', icon: Pill }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = aiActiveTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setAiActiveTab(tab.id as any);
                      navigate(`/patient/analytics?tab=${tab.id}`);
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                        isActive ? 'bg-blue-500 text-white' : 'bg-slate-200/80 text-slate-700'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* =========================================================================
              TAB 1: HEALTH TRENDS & VITALS (SIMPLE, CLEAR, NO CLUTTER)
             ========================================================================= */}
          {aiActiveTab === 'charts' && <PatientHealthTrends key={searchParams.get('add') || 'trends'} openAddForm={searchParams.get('add') === '1'} />}

          {/* =========================================================================
              TAB 2: MY TEST REPORTS EXPLAINED (CLEAN 2-COLUMN LAYOUT)
             ========================================================================= */}
          {aiActiveTab === 'reports' && (
            <PatientReportsExplained records={records} initialReportId={new URLSearchParams(location.search).get('reportId') || undefined} />
          )}

          {/* =========================================================================
              TAB 3: ASK AI ASSISTANT (CALM, CLEAN, NO DUPLICATE INPUTS)
             ========================================================================= */}
          {aiActiveTab === 'chat' && (
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-5 animate-fade-in">
              
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-slate-900">Ask Your Health Companion</h3>
                  <p className="text-xs text-slate-500">Answers come from your own reports and readings, with the sources shown</p>
                </div>
                {chatMessages.length > 1 && (
                  <button
                    type="button"
                    onClick={handleNewConversation}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 border border-slate-200 rounded-lg px-2.5 py-1.5"
                  >
                    <RefreshCw className="w-3 h-3" /> New conversation
                  </button>
                )}
              </div>

              {/* Suggested Questions */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 tracking-wider block">Click a question to ask instantly:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Are any of my results outside the normal range?',
                    'Is my blood pressure improving?',
                    'How have my results changed over time?',
                    'What medicines are in my records?',
                    'What should I ask my doctor at my next visit?'
                  ].map((q, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleAskAi(q)}
                      className="text-xs bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 px-3.5 py-2 rounded-xl border border-slate-200 font-medium transition-all"
                    >
                      ✨ {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Stream */}
              <div ref={chatScrollRef} aria-live="polite" className="space-y-3 max-h-[420px] overflow-y-auto p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 text-xs ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.sender === 'ai' && (
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div
                      className={`p-4 rounded-2xl max-w-xl space-y-1 ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-none shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className={`text-[10px] font-bold ${msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                          {msg.sender === 'user' ? 'You' : 'Health AI'}
                        </span>
                        <span className={`text-[10px] ${msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                          {msg.time}
                        </span>
                      </div>
                      <p translate="no" className="leading-relaxed font-normal whitespace-pre-line">{msg.text}</p>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="pt-2 mt-1 border-t border-slate-100 flex flex-wrap gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 w-full">Based on</span>
                          {msg.sources.map((src, si) => {
                            const label = `${src.label} · ${formatDate(src.date)}`;
                            return src.reportId ? (
                              <button
                                key={si}
                                type="button"
                                onClick={() => navigate(`/patient/analytics?tab=reports&reportId=${src.reportId}`)}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 inline-flex items-center gap-1"
                              >
                                <FileText className="w-3 h-3" /> {label}
                              </button>
                            ) : (
                              <span key={si} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600 inline-flex items-center gap-1">
                                <Activity className="w-3 h-3" /> {label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {aiLoading && (
                  <div className="flex gap-3 text-xs">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-2xl rounded-bl-none text-slate-500 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>Writing plain-language explanation...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Ask Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (aiQuestion.trim()) {
                    handleAskAi(aiQuestion);
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  placeholder="Type any question about your test results, diet, or medicine..."
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  className="w-full text-xs p-3.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                />
                <Button type="submit" size="sm" isLoading={aiLoading} className="text-xs font-bold shrink-0 px-5">
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Ask AI
                </Button>
              </form>

              <p className="text-[11px] text-slate-400 text-center">
                Private – personal details are removed before the AI reads anything. This is general information, not a diagnosis; ask your doctor about any decision.
              </p>

            </div>
          )}

          {/* =========================================================================
              TAB 4: MY MEDICATIONS & SAFETY
             ========================================================================= */}
          {aiActiveTab === 'medications' && <PatientMedicationsPanel records={records} />}

        </div>
      )}


      {/* =========================================================================
          SUB-ROUTE 5: ACTIVITY TIMELINE (/patient/activity)
         ========================================================================= */}
      {isActivityView && (
        <div className="space-y-6 animate-fade-in">
          <PageHeader tag={patientName} title="Activity" subtitle="Everything that happened to your records: uploads, sharing and who opened what." />
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-sky-600" />
                  <span>Your Personal Health Activity Trail</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Every upload, every time you share, and every time a doctor opens a file.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={openActivityModal} className="text-xs font-semibold">
                See full history
              </Button>
            </div>

            <LiveActivityTimeline accent="sky" />
          </Card>
        </div>
      )}

      {/* =========================================================================
          SUB-ROUTE 6: NOTIFICATIONS (/patient/notifications)
         ========================================================================= */}
      {isNotificationsView && (
        <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
          <PageHeader tag={patientName} title="Notifications" subtitle="Requests from doctors and new reports added to your records." />
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Notifications &amp; Alerts</h3>
                <p className="text-xs text-slate-500">Alerts regarding your health records and doctor access</p>
              </div>
            </div>

            <LiveNotificationsList />
          </Card>
        </div>
      )}

      {/* =========================================================================
          SUB-ROUTE 7: SETTINGS (/patient/settings)
         ========================================================================= */}
      {isSettingsView && (
        <div className="space-y-6 animate-fade-in font-sans pb-12 max-w-4xl mx-auto">
          
          {/* Header Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
                  <Settings className="w-3.5 h-3.5 text-slate-600" />
                  <span>Account Center</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Settings &amp; Security
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-normal">
                  Change your details, your password and how you sign in.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto px-3.5 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Account Status: Active &amp; Protected</span>
              </div>
            </div>

            {/* Clean Segmented Tab Switcher */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              {[
                { id: 'profile', label: 'Profile & Emergency', icon: User },
                { id: 'security', label: 'Password & Security', icon: Lock, badge: 'Crucial' },
                { id: 'notifications', label: 'Notification Preferences', icon: Bell },
                { id: 'data', label: 'Data Export', icon: Download }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = settingsActiveTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSettingsActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                        isActive ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* =========================================================================
              TAB 1: PERSONAL PROFILE & EMERGENCY
             ========================================================================= */}
          {settingsActiveTab === 'profile' && (
            <Card className="p-6 sm:p-7 border border-slate-200/80 shadow-xs rounded-3xl space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span>Personal Profile &amp; Medical Contact Information</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This contact information is used for doctor consultations and emergency clinical admissions.
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const result = await savePatientProfile();
                  setToast(result.message);
                }}
                className="space-y-4 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">Full Legal Name</label>
                    <input
                      type="text"
                      value={patientProfile.name}
                      onChange={(e) => setPatientProfile({ ...patientProfile, name: e.target.value })}
                      className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">Registered Email Address</label>
                    <input
                      type="email"
                      value={patientProfile.email}
                      onChange={(e) => setPatientProfile({ ...patientProfile, email: e.target.value })}
                      className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">Primary Mobile Phone</label>
                    <input
                      type="text"
                      value={patientProfile.phone}
                      onChange={(e) => setPatientProfile({ ...patientProfile, phone: e.target.value })}
                      className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">Verified Blood Group</label>
                    <input
                      type="text"
                      value={patientProfile.bloodGroup}
                      onChange={(e) => setPatientProfile({ ...patientProfile, bloodGroup: e.target.value })}
                      className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Residential Home Address</label>
                  <input
                    type="text"
                    value={patientProfile.address}
                    onChange={(e) => setPatientProfile({ ...patientProfile, address: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Allergies</label>
                  <input
                    type="text"
                    value={patientProfile.allergies}
                    placeholder="e.g. Penicillin, peanuts – or leave blank if none"
                    onChange={(e) => setPatientProfile({ ...patientProfile, allergies: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Emergency Contact */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-4 h-4 text-rose-500" />
                    <h4 className="text-xs font-bold text-slate-900">Designated Emergency Contact</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">Contact Full Name &amp; Relationship</label>
                      <input
                        type="text"
                        value={patientProfile.emergencyContactName}
                        onChange={(e) => setPatientProfile({ ...patientProfile, emergencyContactName: e.target.value })}
                        className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">Emergency Phone Number</label>
                      <input
                        type="text"
                        value={patientProfile.emergencyContactPhone}
                        onChange={(e) => setPatientProfile({ ...patientProfile, emergencyContactPhone: e.target.value })}
                        className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <Button type="submit" size="sm" className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Profile Changes</span>
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* =========================================================================
              TAB 2: PASSWORD & SECURITY (CHANGE PASSWORD + FORGOT PASSWORD + 2FA)
             ========================================================================= */}
          {settingsActiveTab === 'security' && (
            <div className="space-y-6 animate-fade-in">

              {/* MetaMask wallet — the private key stays in MetaMask; MedLedger never stores or exports keys */}
              <WalletCard />

              {/* SECTION A: CHANGE PASSWORD FORM */}
              <Card className="p-6 sm:p-7 border border-slate-200/80 shadow-xs rounded-3xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-indigo-600" />
                      <span>Change Account Password</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Use a strong password so only you can open your records.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPwChangeError(null);
                    setPwChangeSuccess(null);

                    if (!currentPasswordInput) {
                      setPwChangeError('Please enter your current password.');
                      return;
                    }
                    const passwordProblem = validatePassword(newPasswordInput);
                    if (passwordProblem) {
                      setPwChangeError(passwordProblem);
                      return;
                    }
                    if (newPasswordInput !== confirmPasswordInput) {
                      setPwChangeError('New password and confirm password do not match.');
                      return;
                    }

                    setPwChangeLoading(true);
                    try {
                      const result = await authApi.changePassword(currentPasswordInput, newPasswordInput);
                      setAuth(result.user, result.token); // previous token is invalidated by the server
                      setPwChangeSuccess(result.message || 'Your password has been updated.');
                      setCurrentPasswordInput('');
                      setNewPasswordInput('');
                      setConfirmPasswordInput('');
                      setToast('Password updated successfully!');
                    } catch (err) {
                      setPwChangeError(apiErrorMessage(err, 'Could not update the password. Please try again.'));
                    } finally {
                      setPwChangeLoading(false);
                    }
                  }}
                  className="space-y-4 text-xs"
                >
                  {pwChangeError && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="font-semibold">{pwChangeError}</span>
                    </div>
                  )}

                  {pwChangeSuccess && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold">{pwChangeSuccess}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Current Password */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">Current Password</label>
                      <div className="relative">
                        <input
                          type={showCurrentPw ? 'text' : 'password'}
                          value={currentPasswordInput}
                          onChange={(e) => setCurrentPasswordInput(e.target.value)}
                          placeholder="Enter current password"
                          className="w-full p-3 pr-10 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPw(!showCurrentPw)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                        >
                          {showCurrentPw ? <Eye className="w-4 h-4" /> : <Eye className="w-4 h-4 opacity-50" />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPw ? 'text' : 'password'}
                          value={newPasswordInput}
                          onChange={(e) => setNewPasswordInput(e.target.value)}
                          placeholder="Min. 6 characters"
                          className="w-full p-3 pr-10 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                        >
                          {showNewPw ? <Eye className="w-4 h-4" /> : <Eye className="w-4 h-4 opacity-50" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPw ? 'text' : 'password'}
                          value={confirmPasswordInput}
                          onChange={(e) => setConfirmPasswordInput(e.target.value)}
                          placeholder="Repeat new password"
                          className="w-full p-3 pr-10 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPw(!showConfirmPw)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                        >
                          {showConfirmPw ? <Eye className="w-4 h-4" /> : <Eye className="w-4 h-4 opacity-50" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password Strength Meter */}
                  {newPasswordInput && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-500">Password Strength:</span>
                        <span className={newPasswordInput.length > 8 ? 'text-emerald-700' : 'text-amber-700'}>
                          {newPasswordInput.length > 8 ? 'Strong & Secure' : 'Medium (Add numbers/symbols)'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full transition-all duration-300 ${
                            newPasswordInput.length > 8 ? 'w-full bg-emerald-500' : 'w-1/2 bg-amber-500'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      size="sm"
                      isLoading={pwChangeLoading}
                      className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Update Password</span>
                    </Button>
                  </div>
                </form>
              </Card>

              {/* SECTION B: FORGOT PASSWORD / PASSWORD RECOVERY */}
              <Card className="p-6 sm:p-7 border border-slate-200/80 shadow-xs rounded-3xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Forgot Password or Locked Out?
                    </h3>
                    <p className="text-xs text-slate-500">
                      Send a secure password reset link to your verified email address to recover your account anytime.
                    </p>
                  </div>
                </div>

                {forgotLinkSent ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                    <div className="flex items-center gap-2 font-bold">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>Password Reset Requested</span>
                    </div>
                    <p className="leading-relaxed font-normal">
                      If an account exists for <strong>{forgotEmailInput}</strong>, a secure recovery link has been sent. It expires in 15 minutes.
                    </p>
                    {forgotDevLink && (
                      <p className="leading-relaxed font-normal">
                        Development mode (no email service configured):{' '}
                        <Link to={forgotDevLink} className="font-bold underline">open the reset link</Link>.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                    <input
                      type="email"
                      value={forgotEmailInput}
                      onChange={(e) => setForgotEmailInput(e.target.value)}
                      placeholder="Your registered email address"
                      className="flex-1 text-xs p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-sky-500"
                    />
                    <Button
                      type="button"
                      size="sm"
                      isLoading={forgotLoading}
                      onClick={async () => {
                        setForgotLoading(true);
                        try {
                          const result = await authApi.forgotPassword(forgotEmailInput);
                          setForgotDevLink(result.devResetToken ? `/reset-password?token=${result.devResetToken}` : null);
                          setForgotLinkSent(true);
                          setToast(result.message);
                        } catch (err) {
                          setToast(apiErrorMessage(err, 'Could not send the reset link.'));
                        } finally {
                          setForgotLoading(false);
                        }
                      }}
                      className="text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shrink-0"
                    >
                      <Send className="w-3.5 h-3.5 mr-1" />
                      Send Reset Link
                    </Button>
                  </div>
                )}
              </Card>

              {/* SECTION C: TWO-STEP SIGN-IN (not built yet) */}
              <Card className="p-6 sm:p-7 border border-slate-200/80 shadow-xs rounded-3xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 border border-slate-200">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-extrabold text-slate-900">Two-step sign-in</h3>
                      <DemoBadge label="Coming soon" />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      A one-time code when you sign in from a new device. Until then, use a strong password and sign out of devices you
                      don&apos;t recognise below.
                    </p>
                  </div>
                </div>
              </Card>

              {/* SECTION D: ACTIVE LOGGED-IN SESSIONS */}
              <ActiveSessionsCard />

            </div>
          )}

          {/* =========================================================================
              TAB 3: NOTIFICATION PREFERENCES
             ========================================================================= */}
          {settingsActiveTab === 'notifications' && (
            <Card className="p-6 sm:p-7 border border-slate-200/80 shadow-xs rounded-3xl space-y-6 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-500" />
                  <span>Notifications</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose what you want to hear about. Your choices are saved. For now, alerts appear in the bell at the top of the page;
                  email and SMS alerts are coming soon.
                </p>
              </div>

              <div className="space-y-3.5 text-xs">
                {[
                  {
                    key: 'doctorAccessAlerts',
                    title: 'Requests to see my records',
                    desc: 'When a doctor asks to see your files.'
                  },
                  {
                    key: 'newReportAlerts',
                    title: 'New reports',
                    desc: 'When a lab or hospital adds a report to your record.'
                  },
                  {
                    key: 'criticalVitalsAlerts',
                    title: 'Results outside the normal range',
                    desc: 'When a new result is higher or lower than normal.'
                  },
                  {
                    key: 'monthlyDigest',
                    title: 'Monthly summary',
                    desc: 'A short recap of your readings and reports each month.'
                  }
                ].map((pref) => {
                  const isChecked = notifPreferences[pref.key as keyof typeof notifPreferences];
                  return (
                    <div
                      key={pref.key}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-4"
                    >
                      <div>
                        <span className="font-bold text-slate-900 block">{pref.title}</span>
                        <span className="text-[11px] text-slate-500 mt-0.5 block">{pref.desc}</span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(isChecked)}
                        aria-label={pref.title}
                        onClick={async () => {
                          const next = { ...notifPreferences, [pref.key]: !isChecked };
                          setNotifPreferences(next);
                          const result = await saveNotifPreferences(next);
                          setToast(result.message);
                        }}
                        className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                          isChecked ? 'bg-blue-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full bg-white shadow-xs absolute top-0.5 transition-transform ${
                            isChecked ? 'right-0.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* =========================================================================
              TAB 4: DATA EXPORT & KEYSTORE BACKUP
             ========================================================================= */}
          {settingsActiveTab === 'data' && (
            <div className="space-y-6 animate-fade-in">
              
              <Card className="p-6 sm:p-7 border border-slate-200/80 shadow-xs rounded-3xl space-y-5">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>Download Personal Emergency Medical Card</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    A one-page summary of your blood group, allergies and emergency contact, taken from your profile. Print it or keep it on
                    your phone.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 text-xs">
                    <span className="font-bold text-slate-900 block">Emergency card</span>
                    <p className="text-slate-500 text-[11px]">
                      Blood group: {patientProfile.bloodGroup || 'not added'} &bull; Allergies: {patientProfile.allergies || 'not added'} &bull;
                      Emergency contact:{' '}
                      {patientProfile.emergencyContactName
                        ? `${patientProfile.emergencyContactName}${patientProfile.emergencyContactPhone ? ` (${patientProfile.emergencyContactPhone})` : ''}`
                        : 'not added'}
                    </p>
                    {(!patientProfile.bloodGroup || !patientProfile.emergencyContactName) && (
                      <p className="text-[11px] text-amber-700">Add the missing details under Personal Profile first.</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      downloadEmergencyCard(patientProfile);
                      setToast('Emergency card downloaded. Open it and print, or save it to your phone.');
                    }}
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Download card
                  </Button>
                </div>
              </Card>


            </div>
          )}

        </div>
      )}


    </div>
  );
};
