import React from 'react';
import { FlaskConical } from 'lucide-react';

/**
 * Marks a feature that only works in this browser tab: changes are not saved and disappear on reload.
 * Used until the matching server feature exists, so no screen claims a result it did not produce.
 */
export const DemoBadge: React.FC<{ label?: string; className?: string }> = ({ label = 'Demo – not saved', className = '' }) => (
  <span
    title="This part is a preview. Changes stay on this screen only and are lost when you reload the page."
    className={`inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-800 ${className}`}
  >
    <FlaskConical className="h-3 w-3" aria-hidden="true" />
    {label}
  </span>
);

/** One line under a demo section explaining what the badge means. */
export const DemoNote: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <p className="mt-2 text-[11px] text-amber-800">
    {children || 'Preview only: changes here are not saved and will be lost when you reload the page.'}
  </p>
);

/** A strip at the top of a section whose data and actions are examples only. */
export const DemoPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-900">
    <DemoBadge />
    <span>{children}</span>
  </div>
);
