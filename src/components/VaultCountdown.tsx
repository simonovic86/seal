'use client';

import { useState, useEffect } from 'react';
import styles from './VaultCountdown.module.css';

interface VaultCountdownProps {
  unlockTime: number;
  onUnlockReady?: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(unlockTime: number): TimeLeft | null {
  const diff = unlockTime - Date.now();
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / 1000 / 60) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function VaultCountdown({ unlockTime, onUnlockReady }: VaultCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() =>
    calculateTimeLeft(unlockTime),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(unlockTime);
      setTimeLeft(newTimeLeft);

      if (!newTimeLeft) {
        clearInterval(timer);
        onUnlockReady?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [unlockTime, onUnlockReady]);

  if (!timeLeft) {
    return (
      <div className={styles.container}>
        <div className={`${styles.badge} ${styles.badgeReady}`}>
          <svg className={styles.badgeIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
            />
          </svg>
          <span className={styles.badgeText}>Ready to unlock</span>
        </div>
      </div>
    );
  }

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className={styles.timeBlock}>
      <div className={styles.timeValue}>
        <span className={styles.timeNumber}>
          {value.toString().padStart(2, '0')}
        </span>
      </div>
      <span className={styles.timeLabel}>
        {label}
      </span>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.badge}>
        <svg className={styles.badgeIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span className={styles.badgeText}>Vault is locked</span>
      </div>

      <div className={styles.timeBlocks}>
        {timeLeft.days > 0 && <TimeBlock value={timeLeft.days} label="Days" />}
        <TimeBlock value={timeLeft.hours} label="Hours" />
        <TimeBlock value={timeLeft.minutes} label="Min" />
        <TimeBlock value={timeLeft.seconds} label="Sec" />
      </div>

      <p className={styles.unlockInfo}>
        Unlocks at {new Date(unlockTime).toLocaleString()}
      </p>
    </div>
  );
}
