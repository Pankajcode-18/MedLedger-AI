import React from 'react';
import { FileQuestion } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <FileQuestion className="w-8 h-8 text-slate-400" />,
  title,
  description,
  action
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4">
        {icon}
      </div>
      <h4 className="text-base font-bold text-slate-800 tracking-tight">{title}</h4>
      <p className="text-sm text-slate-500 max-w-sm mt-1 mb-6 leading-relaxed">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
