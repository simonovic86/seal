'use client';

import { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap and escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };

    document.addEventListener('keydown', handleEscape);
    modalRef.current?.focus();

    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const iconColor = variant === 'danger' ? 'text-red-400' : 'text-amber-400';
  const iconBg = variant === 'danger' ? 'bg-red-500/20' : 'bg-amber-500/20';
  const confirmBg = variant === 'danger' 
    ? 'bg-red-600 hover:bg-red-500' 
    : 'bg-amber-600 hover:bg-amber-500';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-sm p-6 rounded-2xl bg-zinc-900 border border-zinc-800 animate-fade-in"
      >
        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div className={`w-14 h-14 rounded-full ${iconBg} flex items-center justify-center mb-4`}>
            {variant === 'danger' ? (
              <svg className={`w-7 h-7 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className={`w-7 h-7 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          
          {/* Title */}
          <h2 id="modal-title" className="text-lg font-semibold text-zinc-100 mb-2">
            {title}
          </h2>
          
          {/* Message */}
          <p className="text-sm text-zinc-400 mb-6">
            {message}
          </p>
          
          {/* Actions */}
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-2.5 rounded-lg font-medium text-white transition-colors ${confirmBg}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

