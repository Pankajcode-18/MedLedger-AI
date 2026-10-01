import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore.js';
import { Button } from './Button.js';
import { Bell } from 'lucide-react';

/** Full-page notification list (same live data as the header bell). */
export const LiveNotificationsList: React.FC = () => {
  const { notifications, markNotificationRead, clearNotifications } = useUIStore();
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wide text-slate-500">
          {unread > 0 ? `${unread} unread` : 'All caught up'}
        </span>
        {unread > 0 && (
          <button
            type="button"
            onClick={clearNotifications}
            className="text-xs font-semibold text-sky-700 hover:text-sky-800"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-10 text-slate-500">
          <Bell className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No notifications yet</p>
          <p className="text-xs mt-1">When a doctor asks to see your records or a new report is added, you will see it here.</p>
        </div>
      )}

      {notifications.map((n) => (
        <div
          key={n.id}
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 text-xs ${
            n.type === 'access_request' && !n.read
              ? 'bg-amber-50/60 border-amber-200'
              : n.read
                ? 'bg-white border-slate-200'
                : 'bg-sky-50/50 border-sky-200'
          }`}
        >
          <div className="min-w-0">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-sky-600 shrink-0" />}
              {n.title}
            </h4>
            <p className="text-slate-600 mt-1 break-words">{n.message}</p>
            <span className="text-[10px] text-slate-400 mt-2 block">{n.time}</span>
          </div>
          {n.actionHref && (
            <Button
              size="sm"
              variant={n.type === 'access_request' ? 'primary' : 'outline'}
              onClick={() => {
                markNotificationRead(n.id);
                navigate(n.actionHref as string);
              }}
              className="shrink-0 text-xs font-bold"
            >
              {n.actionText || 'Open'}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
};
