'use client';

import { useState, useEffect, useCallback } from 'react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, isVisible, onClose, duration = 2000 }: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  return (
    <div
      className="
        fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        px-4 py-2.5 rounded-lg
        bg-zinc-800 border border-zinc-700
        text-sm text-zinc-100 font-medium
        shadow-lg shadow-black/20
        animate-toast-in
      "
    >
      <div className="flex items-center gap-2">
        <svg
          className="w-4 h-4 text-emerald-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        {message}
      </div>
    </div>
  );
}

// Hook for easy toast usage
export function useToast() {
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);

  const showToast = useCallback((message: string) => {
    setToast({ message, key: Date.now() });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const ToastComponent = toast ? (
    <Toast
      key={toast.key}
      message={toast.message}
      isVisible={true}
      onClose={hideToast}
    />
  ) : null;

  return { showToast, ToastComponent };
}

