import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore.js';
import {
  Bell,
  CheckCircle2,
  KeyRound,
  FileText,
  Shield,
  Lock,
  ArrowRight,
  Check,
  X
} from 'lucide-react';

export const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { notifications, markNotificationRead, clearNotifications } = useUIStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'access_request':
        return <KeyRound className="w-4 h-4 text-amber-600" />;
      case 'record_verified':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'report_ready':
        return <FileText className="w-4 h-4 text-sky-600" />;
      case 'claim_update':
        return <Shield className="w-4 h-4 text-cyan-600" />;
      default:
        return <Lock className="w-4 h-4 text-slate-600" />;
    }
  };

  const handleAction = (href?: string, id?: string) => {
    if (id) markNotificationRead(id);
    setIsOpen(false);
    if (href) navigate(href);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors focus:outline-none"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in text-xs">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 font-bold rounded-full text-[10px]">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={clearNotifications}
                className="text-[11px] text-sky-600 hover:text-sky-800 font-semibold"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-400">No notifications right now.</div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3.5 transition-colors flex items-start gap-3 hover:bg-slate-50 ${
                    !notif.read ? 'bg-sky-50/40' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 truncate text-xs">{notif.title}</h4>
                      <span className="text-[10px] text-slate-400 shrink-0">{notif.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{notif.message}</p>
                    {notif.actionHref && (
                      <button
                        type="button"
                        onClick={() => handleAction(notif.actionHref, notif.id)}
                        className="mt-2 inline-flex items-center gap-1 font-bold text-sky-600 hover:text-sky-700 text-[11px]"
                      >
                        <span>{notif.actionText || 'Review'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0 mt-1.5" title="Unread" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
            <span className="text-[10px] text-slate-400">Updates about your account</span>
          </div>
        </div>
      )}
    </div>
  );
};
