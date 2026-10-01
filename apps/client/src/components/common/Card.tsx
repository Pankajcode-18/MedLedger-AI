import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, hoverEffect = false, className, ...props }) => {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 p-6',
          hoverEffect && 'transition-all duration-200 hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
