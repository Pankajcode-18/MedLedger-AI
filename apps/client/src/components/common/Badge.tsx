import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'verified' | 'pending' | 'revoked' | 'info' | 'default' | 'success' | 'warning' | 'danger' | 'neutral';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  dot = false,
  className,
  ...props
}) => {
  const variantStyles = {
    verified: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    pending: 'bg-amber-50 text-amber-700 border-amber-200/80',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/80',
    revoked: 'bg-rose-50 text-rose-700 border-rose-200/80',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/80',
    info: 'bg-sky-50 text-sky-700 border-sky-200/80',
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  const dotColors = {
    verified: 'bg-emerald-500',
    success: 'bg-emerald-500',
    pending: 'bg-amber-500',
    warning: 'bg-amber-500',
    revoked: 'bg-rose-500',
    danger: 'bg-rose-500',
    info: 'bg-sky-500',
    default: 'bg-slate-400',
    neutral: 'bg-slate-400'
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border tracking-wide',
          variantStyles[variant],
          className
        )
      )}
      {...props}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
};
