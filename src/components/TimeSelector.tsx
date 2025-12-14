'use client';

import { useState, useEffect } from 'react';

interface TimeSelectorProps {
  value: Date | null;
  onChange: (date: Date) => void;
}

const PRESETS = [
  { label: '1 hour', hours: 1 },
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 24 * 7 },
  { label: '30 days', hours: 24 * 30 },
];

export function TimeSelector({ value, onChange }: TimeSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [minDateString, setMinDateString] = useState('');

  // Calculate min date on client only to avoid hydration mismatch
  useEffect(() => {
    const minDate = new Date(Date.now() + 60 * 1000);
    setMinDateString(minDate.toISOString().slice(0, 16));
  }, [showCustom]);

  const handlePreset = (hours: number) => {
    const date = new Date(Date.now() + hours * 60 * 60 * 1000);
    onChange(date);
    setShowCustom(false);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    if (!isNaN(date.getTime())) {
      onChange(date);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        Lock until
      </label>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handlePreset(preset.hours)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className={`
            px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${showCustom ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}
          `}
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <input
          type="datetime-local"
          min={minDateString}
          onChange={handleCustomChange}
          className="
            w-full px-4 py-2 rounded-lg
            bg-zinc-800 border border-zinc-700
            text-zinc-100 placeholder-zinc-500
            focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
          "
        />
      )}

      {value && (
        <p className="text-sm text-zinc-400">
          Unlocks: {value.toLocaleString()}
        </p>
      )}
    </div>
  );
}
