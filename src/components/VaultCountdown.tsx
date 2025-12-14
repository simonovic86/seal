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
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
            />
          </svg>
          <span className="font-medium">Ready to unlock!</span>
        </div>
      </div>
    );
  }

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
        <span className="text-2xl sm:text-3xl font-mono font-bold text-zinc-100">
          {value.toString().padStart(2, '0')}
        </span>
      </div>
      <span className="mt-2 text-xs sm:text-sm text-zinc-500 uppercase tracking-wide">
        {label}
      </span>
    </div>
  );

  return (
    <div className="text-center py-8">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 text-amber-400 mb-6">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span className="font-medium">Vault is locked</span>
      </div>

      <div className="flex justify-center gap-3 sm:gap-4">
        {timeLeft.days > 0 && <TimeBlock value={timeLeft.days} label="Days" />}
        <TimeBlock value={timeLeft.hours} label="Hours" />
        <TimeBlock value={timeLeft.minutes} label="Min" />
        <TimeBlock value={timeLeft.seconds} label="Sec" />
      </div>

      <p className="mt-6 text-sm text-zinc-500">
        Unlocks at {new Date(unlockTime).toLocaleString()}
      </p>
    </div>
  );
}
