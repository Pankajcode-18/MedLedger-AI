import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button.js';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-4">
        <FileQuestion className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Page Not Found</h1>
      <p className="text-sm text-slate-500 max-w-sm mt-1 mb-6">
        The healthcare portal or record you are looking for does not exist or has been relocated.
      </p>
      <Link to="/">
        <Button icon={<ArrowLeft className="w-4 h-4" />}>Return to Home</Button>
      </Link>
    </div>
  );
};
