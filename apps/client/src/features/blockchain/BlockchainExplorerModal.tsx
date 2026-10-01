import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../store/uiStore.js';
import { blockchainApi } from '../../api/blockchainApi.js';
import { BlockchainBlock, LedgerStatus } from '../../types/index.js';
import { Modal } from '../../components/common/Modal.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { formatDateTime } from '../../lib/format.js';
import {
  ShieldCheck,
  Link,
  Search,
  Copy,
  Check,
  Info,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  User,
  Cpu,
  Layers,
  ExternalLink
} from 'lucide-react';

export const BlockchainExplorerModal: React.FC = () => {
  const { isBlocksModalOpen, closeBlocksModal } = useUIStore();
  const [blocks, setBlocks] = useState<BlockchainBlock[]>([]);
  const [status, setStatus] = useState<LedgerStatus | null>(null);
  // real check: every entry must point at the one before it
  const ordered = [...blocks].sort((a, b) => a.blockNumber - b.blockNumber);
  const linksOk = ordered.every(
    (b, i) => i === 0 || (b.previousHash || '').toLowerCase() === (ordered[i - 1].currentHash || '').toLowerCase()
  );
  // the server also recomputes every entry's hash, which catches an edited entry
  const chainIntact = linksOk && (status ? status.intact : true);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'record' | 'sharing'>('all');
  const [openProofs, setOpenProofs] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isBlocksModalOpen) {
      fetchBlocks();
    }
  }, [isBlocksModalOpen]);

  const fetchBlocks = async () => {
    setLoading(true);
    try {
      const [data, st] = await Promise.all([blockchainApi.getBlocks(), blockchainApi.getStatus().catch(() => null)]);
      setBlocks(data);
      setStatus(st);
      if (data.length > 0) {
        const last = data[data.length - 1].blockNumber;
        setOpenProofs((prev) => ({ ...prev, [last]: true }));
      }
    } catch (e) {
      console.error('Failed to load blockchain entries', e);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleProof = (num: number) => {
    setOpenProofs((prev) => ({ ...prev, [num]: !prev[num] }));
  };

  const filteredBlocks = blocks.filter((b) => {
    const t = (b.type || '').toLowerCase();
    if (filterType === 'record' && !t.includes('fingerprint')) return false;
    if (filterType === 'sharing' && !t.includes('shar')) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const currHash = (b.currentHash || '').toLowerCase();
    const prevHash = (b.previousHash || '').toLowerCase();
    const payload = JSON.stringify(b.payload || b.data || '').toLowerCase();

    return t.includes(q) || currHash.includes(q) || prevHash.includes(q) || payload.includes(q);
  });

  const getHumanEvent = (block: BlockchainBlock) => {
    const t = (block.type || '').toLowerCase();
    const p = (block.payload || block.data || {}) as Record<string, unknown>;
    const later = p.addedLater ? ' (added when the history was first saved; the original event happened earlier)' : '';
    if (t.includes('started') || t.includes('genesis')) {
      return {
        title: 'Record history started',
        badge: 'Start',
        icon: <Layers className="w-5 h-5 text-sky-600" />,
        summary: 'The first entry. Every later entry is linked to the one before it.'
      };
    }
    if (t.includes('stopped sharing')) {
      return {
        title: 'Stopped sharing with a doctor',
        badge: 'Sharing',
        icon: <User className="w-5 h-5 text-rose-600" />,
        summary: `Patient ${p.patientId} stopped sharing with doctor ${p.doctorId}${p.confirmedWith === 'onchain' ? ', confirmed in MetaMask' : ''}.${later}`
      };
    }
    if (t.includes('shared with')) {
      return {
        title: 'Shared with a doctor',
        badge: 'Sharing',
        icon: <Cpu className="w-5 h-5 text-indigo-600" />,
        summary: `Patient ${p.patientId} shared their records with doctor ${p.doctorId}${p.confirmedWith === 'onchain' ? ', confirmed in MetaMask' : ''}.${later}`
      };
    }
    return {
      title: 'Report fingerprint saved',
      badge: 'Report',
      icon: <FileText className="w-5 h-5 text-amber-600" />,
      summary: `A report for patient ${p.patientId} was locked and its fingerprint saved. If the file is changed later, the check will show it.${later}`
    };
  };

  const chainBadge = (block: BlockchainBlock) => {
    const c = block.chain;
    if (!c) return <Badge variant="default">Saved on this server</Badge>;
    if (c.status === 'confirmed')
      return (
        <span className="inline-flex items-center gap-2">
          <Badge variant="verified" dot>
            On {c.network}
            {c.by === 'patient-wallet' ? ' · sent from the patient’s MetaMask' : ''}
          </Badge>
          {c.explorerUrl && (
            <a href={c.explorerUrl} target="_blank" rel="noreferrer" className="ml-tap inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:underline">
              View transaction <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </span>
      );
    if (c.status === 'failed') return <Badge variant="danger">Not written to {c.network}: {c.error || 'unknown error'}</Badge>;
    return <Badge variant="warning">Waiting for {c.network}</Badge>;
  };

  return (
    <Modal
      isOpen={isBlocksModalOpen}
      onClose={closeBlocksModal}
      maxWidth="4xl"
      title={
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-sky-600" />
          <span>Record history</span>
        </div>
      }
      subtitle="Every upload and every sharing decision, in order, each linked to the one before."
    >
      <div className="space-y-6">
        {/* Metric Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Entries</span>
            <span className="text-base font-bold text-slate-900">{blocks.length}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">Links</span>
            <span className={`text-base font-bold ${chainIntact ? 'text-emerald-600' : 'text-rose-600'}`}>
              {blocks.length === 0 ? 'No entries yet' : chainIntact ? 'Links intact' : 'Broken link found'}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">Network</span>
            <span className="text-base font-bold text-slate-900">
              {status?.mode === 'contract' ? status.network : 'This server only'}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">On the blockchain</span>
            <span className="text-base font-bold text-slate-900">
              {status?.mode === 'contract'
                ? `${status.chain.confirmed} confirmed${status.chain.waiting ? ` · ${status.chain.waiting} waiting` : ''}${status.chain.failed ? ` · ${status.chain.failed} failed` : ''}`
                : 'No contract set up'}
            </span>
          </div>
        </div>

        {/* Plain Language Guide Banner */}
        <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-sky-900 leading-relaxed">
            <strong>How to read this:</strong> every upload and sharing decision adds an entry. Each entry includes the
            fingerprint of the one before it, so if an old entry is edited or removed, the check above shows a broken
            link.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by patient ID, doctor ID or fingerprint"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
            {(['all', 'record', 'sharing'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setFilterType(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                  filterType === key
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {key === 'all' ? `All (${blocks.length})` : key === 'record' ? 'Reports' : 'Sharing'}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline Body */}
        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="text-center py-12 text-sm text-slate-500">Loading the record history…</div>
          ) : filteredBlocks.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-500">No records match your search.</div>
          ) : (
            filteredBlocks.map((block, idx) => {
              const eventInfo = getHumanEvent(block);
              const isOpen = openProofs[block.blockNumber];

              return (
                <div key={block.blockNumber} className="relative">
                  {idx > 0 && (
                    <div className="flex items-center justify-center my-2">
                      <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-0.5 rounded-full text-[10px] font-bold text-slate-600">
                        <Link className="w-3 h-3 text-sky-600" />
                        <span>
                          {(() => {
                            const prev = ordered.find((x) => x.blockNumber === block.blockNumber - 1);
                            if (!prev) return 'Earlier entries hidden by the filter';
                            return (prev.currentHash || '').toLowerCase() === (block.previousHash || '').toLowerCase()
                              ? 'Linked to the entry before'
                              : 'Link broken here';
                          })()}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="border border-slate-200/80 rounded-2xl bg-white shadow-sm hover:shadow transition-shadow overflow-hidden">
                    {/* Header */}
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/40 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                          {eventInfo.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">ENTRY #{block.blockNumber}</span>
                            <Badge variant="info">{eventInfo.badge}</Badge>
                          </div>
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                            {eventInfo.title}
                          </h4>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 self-end sm:self-auto">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDateTime(String(block.timestamp))}</span>
                      </div>
                    </div>

                    {/* Content Summary */}
                    <div className="p-4 sm:p-5 space-y-3">
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                        <strong className="text-slate-900">What happened: </strong>
                        {eventInfo.summary}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {chainBadge(block)}
                        {block.blockNumber > 0 && <Badge variant="default">Linked to entry #{block.blockNumber - 1}</Badge>}
                      </div>

                      {/* Cryptographic Inspector Toggle */}
                      <div className="pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => toggleProof(block.blockNumber)}
                          className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 hover:text-sky-600 transition-colors py-1"
                        >
                          <span>{isOpen ? 'Hide technical details' : 'Show technical details'}</span>
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {isOpen && (
                          <div className="mt-3 bg-slate-900 text-slate-200 p-4 rounded-xl text-xs space-y-3 font-mono">
                            <div>
                              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                                <span>RECORD DIGITAL FINGERPRINT (SHA-256):</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyToClipboard(block.currentHash, `curr-${block.blockNumber}`)
                                  }
                                  className="flex items-center gap-1 text-sky-400 hover:text-sky-300"
                                >
                                  {copiedKey === `curr-${block.blockNumber}` ? (
                                    <>
                                      <Check className="w-3 h-3" /> Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" /> Copy
                                    </>
                                  )}
                                </button>
                              </div>
                              <p className="break-all text-sky-300 bg-slate-950/60 p-2 rounded border border-slate-800">
                                {block.currentHash}
                              </p>
                            </div>

                            <div>
                              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                                <span>PREVIOUS RECORD LINK:</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyToClipboard(block.previousHash, `prev-${block.blockNumber}`)
                                  }
                                  className="flex items-center gap-1 text-sky-400 hover:text-sky-300"
                                >
                                  {copiedKey === `prev-${block.blockNumber}` ? (
                                    <>
                                      <Check className="w-3 h-3" /> Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" /> Copy
                                    </>
                                  )}
                                </button>
                              </div>
                              <p className="break-all text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800">
                                {block.previousHash}
                              </p>
                            </div>

                            {(block.payload || block.data) && (
                              <div>
                                <span className="text-[11px] text-slate-400 block mb-1">SAVED METADATA:</span>
                                <pre className="text-[11px] text-slate-300 bg-slate-950/60 p-2.5 rounded border border-slate-800 overflow-x-auto">
                                  {JSON.stringify(block.payload || block.data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className={`w-2 h-2 rounded-full ${chainIntact ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            <span>
              {status?.mode === 'contract'
                ? `Also written to the HealthRecords contract on ${status.network}.`
                : 'Kept on this server. Set up the HealthRecords contract to also write it to Ethereum.'}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={closeBlocksModal}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
