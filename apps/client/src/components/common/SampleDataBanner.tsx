import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { systemApi } from '../../api/systemApi.js';

/** Shown on every signed-in page while the server runs with demo accounts, so sample data is never mistaken for real data. */
export const SampleDataBanner: React.FC = () => {
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    systemApi.demoMode().then(setDemo);
  }, []);
  if (!demo) return null;
  return (
    <div role="note" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        <strong>Sample data.</strong> This system is running with sample accounts. The people, organisations and figures you see are
        made up. Changes you make are saved like real ones.
      </span>
    </div>
  );
};
