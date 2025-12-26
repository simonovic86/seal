'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from './TimeSelector.module.css';

interface TimeSelectorProps {
  value: Date | null;
  onChange: (date: Date) => void;
}

const PRESETS = [
  { label: '1h', hours: 1 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 24 * 7 },
  { label: '30d', hours: 24 * 30 },
] as const;

type PresetHours = typeof PRESETS[number]['hours'];
type Selection = PresetHours | 'custom' | null;

export function TimeSelector({ value, onChange }: TimeSelectorProps) {
  const [selection, setSelection] = useState<Selection>(null);
  const [minDateString, setMinDateString] = useState('');

  // Calculate min date on client only to avoid hydration mismatch
  useEffect(() => {
    const minDate = new Date(Date.now() + 60 * 1000);
    setMinDateString(minDate.toISOString().slice(0, 16));
  }, [selection]);

  const handlePreset = (hours: PresetHours) => {
    setSelection(hours);
    const date = new Date(Date.now() + hours * 60 * 60 * 1000);
    onChange(date);
  };

  const handleCustomClick = () => {
    setSelection('custom');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    if (!isNaN(date.getTime())) {
      onChange(date);
    }
  };

  const showCustomInput = selection === 'custom';

  // Format the unlock time nicely
  const formattedUnlockTime = useMemo(() => {
    if (!value) return null;
    return value.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [value]);

  return (
    <div className={styles.container}>
      <label className={styles.label}>
        Lock until
      </label>

      {/* Segmented control container */}
      <div className={styles.segmentedControl}>
        {PRESETS.map((preset) => {
          const isSelected = preset.hours === selection;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePreset(preset.hours)}
              className={`${styles.pill} ${isSelected ? styles.pillActive : ''}`}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={handleCustomClick}
          className={`${styles.pill} ${selection === 'custom' ? styles.pillActive : ''}`}
        >
          Custom
        </button>
      </div>

      {/* Custom datetime input */}
      {showCustomInput && (
        <input
          type="datetime-local"
          min={minDateString}
          onChange={handleCustomChange}
          className={styles.customInput}
        />
      )}

      {/* Unlocks at line */}
      {value && (
        <p className={styles.unlockTime}>
          Unlocks at: <span className={styles.unlockTimeValue}>{formattedUnlockTime}</span>
        </p>
      )}
    </div>
  );
}
