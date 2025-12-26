'use client';

import { useEffect, useRef } from 'react';
import styles from './ConfirmModal.module.css';
import '@/styles/shared.css';

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

  return (
    <div 
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div 
        className={styles.backdrop}
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        tabIndex={-1}
        className={styles.modal}
      >
        <div className={styles.content}>
          {/* Icon */}
          <div className={styles.iconContainer}>
            <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          {/* Title */}
          <h2 id="modal-title" className={styles.title}>
            {title}
          </h2>
          
          {/* Message */}
          <p className={styles.message}>
            {message}
          </p>
          
          {/* Actions */}
          <div className={styles.actions}>
            <button
              onClick={onCancel}
              className={`btn-secondary ${styles.cancelButton}`}
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`btn-primary ${styles.confirmButton}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
