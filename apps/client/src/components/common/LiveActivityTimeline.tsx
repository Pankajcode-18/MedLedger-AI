import React from 'react';
import { useUIStore } from '../../store/uiStore.js';
import { activityTag } from '../../lib/activityFeed.js';
import { History } from 'lucide-react';

type Accent = 'sky' | 'emerald';

const ACCENT: Record<Accent, { dot: string; tag: string }> = {
  sky: { dot: 'bg-sky-600', tag: 'text-sky-700 bg-sky-50 border-sky-200' },
  emerald: { dot: 'bg-emerald-600', tag: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
};

/** Real audit-trail timeline for the signed-in user (fed by useLiveFeed). */
export const LiveActivityTimeline: React.FC<{ accent?: Accent; limit?: number }> = ({
  accent = 'emerald',
  limit = 25
}) => {
  const { activity, activityLoaded, setSelectedActivityItem } = useUIStore();
  const colors = ACCENT[accent];

  if (!activityLoaded) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 text-slate-500">
        <History className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm font-semibold text-slate-700">No activity yet</p>
        <p className="text-xs mt-1 max-w-sm">
          Uploads, sharing requests, sharing changes and file downloads will appear here as they happen.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {activity.slice(0, limit).map((item) => (
        <button
          type="button"
          key={item.id}
          onClick={() => setSelectedActivityItem(item)}
          className="relative block w-full text-left group"
        >
          <div
            className={`absolute -left-[27px] top-1.5 w-4 h-4 rounded-full ${colors.dot} ring-4 ring-white border-2 border-white`}
          />
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 group-hover:bg-white group-hover:border-slate-300 transition-all">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-900">{item.title}</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${colors.tag}`}>
                  {activityTag(item)}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">{item.time}</span>
            </div>
            {item.description && <p className="text-xs text-slate-600">{item.description}</p>}
          </div>
        </button>
      ))}
    </div>
  );
};
