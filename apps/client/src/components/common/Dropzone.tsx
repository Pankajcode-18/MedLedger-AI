import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFileSelect,
  selectedFile = null,
  accept = '.pdf,.docx,.txt',
  maxSizeMB = 50,
  label = 'Drag and drop your file here, or click to browse'
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={clsx(
        'relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200',
        isDragOver
          ? 'border-sky-500 bg-sky-50/50 scale-[1.01]'
          : selectedFile
          ? 'border-emerald-300 bg-emerald-50/30'
          : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />

      <div className="flex flex-col items-center justify-center gap-3">
        {selectedFile ? (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{selectedFile.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Ready to upload
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Drag your medical report here, or <span className="text-sky-600 underline">browse</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Supports PDF, DOCX, and TXT up to {maxSizeMB}MB</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
