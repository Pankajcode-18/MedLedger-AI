import React, { useCallback, useEffect, useState } from 'react';
import { Card } from './Card.js';
import { authApi, SessionInfo } from '../../api/authApi.js';
import { apiErrorMessage } from '../../lib/password.js';
import { relativeTime } from '../../lib/activityFeed.js';
import { Monitor, Smartphone, LogOut } from 'lucide-react';

/** Turns a user-agent string into something readable, e.g. "Chrome on Windows". */
const describeDevice = (ua: string): { label: string; mobile: boolean } => {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : /node|undici|curl|axios/i.test(ua)
            ? 'API client'
            : 'Browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'unknown system';
  return { label: `${browser} · ${os}`, mobile: /Android|iPhone|iPad|Mobile/.test(ua) };
};

/** Real list of signed-in devices with "sign out everywhere else". */
export const ActiveSessionsCard: React.FC = () => {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSessions(await authApi.listSessions());
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your signed-in devices.'));
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const signOutOthers = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await authApi.logoutOthers();
      setMessage(res.message);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not sign out other devices.'));
    } finally {
      setBusy(false);
    }
  };

  const others = (sessions || []).filter((s) => !s.current).length;

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Monitor className="w-4 h-4 text-slate-600" />
            <span>Signed-in Devices</span>
          </h3>
          <p className="text-xs text-slate-500">Every device that currently has access to this account.</p>
        </div>
        <button
          type="button"
          onClick={signOutOthers}
          disabled={busy || others === 0}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-800 disabled:text-slate-400 disabled:cursor-not-allowed self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out all other devices
        </button>
      </div>

      {message && <p role="status" className="mb-3 text-xs font-semibold text-emerald-700">{message}</p>}
      {error && <p role="alert" className="mb-3 text-xs font-semibold text-rose-700">{error}</p>}

      {sessions === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2 text-xs">
          {sessions.map((s) => {
            const d = describeDevice(s.device);
            const Icon = d.mobile ? Smartphone : Monitor;
            return (
              <li
                key={s.id}
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  s.current ? 'bg-sky-50/70 border-sky-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${s.current ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block truncate">{d.label}</span>
                    <span className="text-slate-500 block truncate">
                      Signed in {relativeTime(s.signedInAt)}
                      {s.ip ? ` · ${s.ip.replace('::ffff:', '')}` : ''}
                    </span>
                  </div>
                </div>
                {s.current && (
                  <span className="text-[10px] font-extrabold text-sky-700 bg-white px-2 py-0.5 rounded-full border border-sky-200 shrink-0">
                    This device
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};
