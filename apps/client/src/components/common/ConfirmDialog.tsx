import React from 'react';
import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose?: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  message?: string;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  variant?: 'primary' | 'danger';
  isLoading?: boolean;
  onCancel?: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  message,
  confirmText,
  confirmLabel,
  cancelText,
  cancelLabel,
  isDestructive = false,
  variant,
  isLoading = false,
  onCancel
}) => {
  const handleClose = onCancel || onClose || (() => {});
  const displayMsg = message || description || '';
  const displayConfirm = confirmLabel || confirmText || 'Confirm';
  const displayCancel = cancelLabel || cancelText || 'Cancel';
  const destructive = isDestructive || variant === 'danger';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth="md">
      <div className="flex items-start gap-4">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            destructive ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h4 className="text-base font-bold text-slate-900">{title}</h4>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">{displayMsg}</p>
          <div className="flex items-center justify-end gap-2.5 mt-6">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={isLoading}>
              {displayCancel}
            </Button>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              size="sm"
              onClick={onConfirm}
              isLoading={isLoading}
            >
              {displayConfirm}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
