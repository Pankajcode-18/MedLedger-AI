import React, { useState } from 'react';
import { useUIStore } from '../../store/uiStore.js';
import { ActivityItem } from '../../types/index.js';
import { Modal } from '../../components/common/Modal.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import {
  History,
  FileText,
  KeyRound,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Search,
  Filter,
  Layers,
  Sparkles,
  Info,
  Clock,
  User,
  ShieldCheck,
  Cpu
} from 'lucide-react';


export const ActivityHistoryModal: React.FC = () => {
  const { activity: liveActivities } = useUIStore();
  const { isActivityModalOpen, closeActivityModal, selectedActivityItem, setSelectedActivityItem } =
    useUIStore();

  const [dateFilter, setDateFilter] = useState<'Any time' | 'Today' | 'This week' | 'Older'>('Any time');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'record' | 'access' | 'login' | 'other'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeItem, setActiveItem] = useState<ActivityItem | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync selected activity item from store
  React.useEffect(() => {
    if (selectedActivityItem) {
      setActiveItem(selectedActivityItem);
    } else if (liveActivities.length > 0 && !activeItem) {
      setActiveItem(liveActivities[0]);
    }
  }, [selectedActivityItem, isActivityModalOpen]);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredList = liveActivities.filter((act) => {
    if (dateFilter === 'Today' && act.dateGroup !== 'Today') return false;
    if (dateFilter === 'This week' && act.dateGroup === 'Earlier') return false;
    if (dateFilter === 'Older' && act.dateGroup !== 'Earlier') return false;
    if (categoryFilter === 'other' && ['record', 'access', 'login'].includes(act.category)) return false;
    if (categoryFilter !== 'all' && categoryFilter !== 'other' && act.category !== categoryFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      act.title.toLowerCase().includes(q) ||
      act.description.toLowerCase().includes(q) ||
      act.actor.toLowerCase().includes(q) ||
      (act.recordName && act.recordName.toLowerCase().includes(q))
    );
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'record':
        return <FileText className="w-4 h-4 text-sky-600" />;
      case 'access':
        return <KeyRound className="w-4 h-4 text-amber-600" />;
      case 'verification':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <Modal
      isOpen={isActivityModalOpen}
      onClose={closeActivityModal}
      maxWidth="4xl"
      title={
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-sky-600" />
          <span>Activity History</span>
        </div>
      }
      subtitle="Everything that happened with your records and who can see them, newest first."
    >
      <div className="space-y-5">
        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold mr-1">When:</span>
            {(['Any time', 'Today', 'This week', 'Older'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  dateFilter === d
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {d}
              </button>
            ))}
            <span className="text-slate-300 mx-1">|</span>
            <span className="text-slate-400 font-semibold mr-1">What:</span>
            {(['all', 'record', 'access', 'login', 'other'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  categoryFilter === c
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {({ all: 'Everything', record: 'Reports', access: 'Sharing', login: 'Sign-ins', other: 'Other' } as const)[c]}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or report"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* 2-Column Layout: Left Vertical Timeline + Right Detail Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[420px]">
          {/* Left: Timeline List (5 cols) */}
          <div className="lg:col-span-5 space-y-4 max-h-[460px] overflow-y-auto pr-1">
            {filteredList.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No activity found matching your search.
              </div>
            ) : (
              filteredList.map((item) => {
                const isSelected = activeItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setActiveItem(item);
                      setShowTechnicalDetails(false);
                    }}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/70 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {getCategoryIcon(item.category)}
                        <span className="font-bold text-slate-900">{item.title}</span>
                      </div>
                      <Badge
                        variant={
                          item.status === 'Verified' || item.status === 'Completed' || item.status === 'Active'
                            ? 'verified'
                            : item.status === 'Pending'
                            ? 'pending'
                            : 'revoked'
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                    {item.description && <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">{item.description}</p>}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 mt-2 border-t border-slate-100">
                      <span>{item.actor}</span>
                      <span>{item.time}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Selected Activity Detail (7 cols) */}
          <div className="lg:col-span-7 bg-slate-50/70 rounded-2xl border border-slate-200/80 p-5 space-y-4 text-xs">
            {activeItem ? (
              <>
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider block">
                      ACTIVITY EVENT
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">{activeItem.title}</h3>
                    <span className="text-slate-500 text-[11px]">
                      {activeItem.dateGroup} &bull; {activeItem.time}
                    </span>
                  </div>
                  <Badge variant="verified">{activeItem.status}</Badge>
                </div>

                {/* Metadata Summary */}
                <div className="grid grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 text-[11px]">
                  <div>
                    <span className="text-slate-400 block font-medium">Record Involved</span>
                    <span className="font-bold text-slate-800 truncate block mt-0.5">
                      {activeItem.recordName || 'Account Profile'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Actor / Initiator</span>
                    <span className="font-bold text-slate-800 truncate block mt-0.5">{activeItem.actor}</span>
                  </div>
                </div>

                {/* Human-Friendly Explainer Box */}
                <div className="p-4 bg-sky-50/80 border border-sky-200/80 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-sky-950 text-xs">
                    <Info className="w-4 h-4 text-sky-600" />
                    <span>What happened here?</span>
                  </div>
                  <p className="text-[11px] text-sky-900 leading-relaxed">{activeItem.explanation}</p>
                </div>

                {/* Collapsible Technical Details (For advanced inspection) */}
                <div className="pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                    className="flex items-center justify-between w-full py-1 text-slate-500 hover:text-slate-900 font-semibold text-xs"
                  >
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-slate-400" />
                      <span>{showTechnicalDetails ? 'Hide technical details' : 'Show technical details'}</span>
                    </span>
                    {showTechnicalDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showTechnicalDetails && activeItem.technicalDetails && (
                    <div className="mt-3 p-3.5 bg-slate-900 text-slate-100 rounded-xl space-y-2.5 font-mono text-[10px] animate-fade-in">
                      <div>
                        <span className="text-slate-400 block text-[9px] tracking-wider">
                          File fingerprint
                        </span>
                        <div className="flex items-center justify-between text-emerald-400 break-all mt-0.5">
                          <span>{activeItem.technicalDetails.digitalFingerprint}</span>
                          <button
                            type="button"
                            onClick={() =>
                              copyText(activeItem.technicalDetails!.digitalFingerprint, 'fingerprint')
                            }
                            className="text-slate-400 hover:text-white ml-2 shrink-0"
                            title="Copy"
                          >
                            {copiedKey === 'fingerprint' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800">
                        <span className="text-slate-400 block text-[9px] tracking-wider">
                          Record history receipt
                        </span>
                        <div className="flex items-center justify-between text-sky-300 break-all mt-0.5">
                          <span>{activeItem.technicalDetails.transactionHash}</span>
                          <button
                            type="button"
                            onClick={() =>
                              copyText(activeItem.technicalDetails!.transactionHash, 'tx')
                            }
                            className="text-slate-400 hover:text-white ml-2 shrink-0"
                            title="Copy"
                          >
                            {copiedKey === 'tx' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex justify-between text-slate-300">
                        <span>Saved on: {activeItem.technicalDetails.network}</span>
                        {activeItem.technicalDetails.blockNumber > 0 && (
                          <span>Entry #{activeItem.technicalDetails.blockNumber}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-16 text-slate-400 text-xs">
                Select an activity event from the left to view complete information.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>Every view, upload and sharing change is kept in this history.</span>

        </div>
      </div>
    </Modal>
  );
};
