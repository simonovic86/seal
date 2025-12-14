'use client';

import { useState, useEffect } from 'react';

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
      <div className="text-center py-6">
        <p className="text-emerald-500 text-sm">Ready to unlock</p>
      </div>
    );
  }

  // Format time as simple string
  const parts: string[] = [];
  if (timeLeft.days > 0) parts.push(`${timeLeft.days}d`);
  if (timeLeft.hours > 0 || timeLeft.days > 0) parts.push(`${timeLeft.hours}h`);
  parts.push(`${timeLeft.minutes}m`);
  parts.push(`${timeLeft.seconds}s`);

  return (
    <div className="text-center py-6">
      <p className="text-3xl font-mono text-zinc-100 tracking-tight">
        {parts.join(' ')}
      </p>
      <p className="mt-3 text-xs text-zinc-600">
        {new Date(unlockTime).toLocaleString()}
      </p>
    </div>
  );
}

