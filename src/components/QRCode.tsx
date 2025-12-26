'use client';

import { useEffect, useRef, useState } from 'react';
import QRCodeLib from 'qrcode';
import styles from './QRCode.module.css';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCode({ value, size = 200, className = '' }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCodeLib.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: {
          dark: '#18181b', // zinc-900
          light: '#fafafa', // zinc-50
        },
      }).catch(() => setError(true));
    }
  }, [value, size]);

  if (error) {
    return (
      <div className={`${styles.errorContainer} ${className}`} style={{ width: size, height: size }}>
        <p className={styles.errorText}>QR generation failed</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.canvas} ${className}`}
    />
  );
}

interface QRCodeModalProps {
  url: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QRCodeModal({ url, isOpen, onClose }: QRCodeModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className={styles.modalOverlay}
      onClick={onClose}
    >
      <div 
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>Scan to Open</h3>
          <button
            onClick={onClose}
            className={styles.closeButton}
          >
            <svg className={styles.closeIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className={styles.qrContainer}>
          <QRCode value={url} size={240} />
        </div>
        
        <p className={styles.hint}>
          Scan this QR code with your phone to open the vault
        </p>
      </div>
    </div>
  );
}

