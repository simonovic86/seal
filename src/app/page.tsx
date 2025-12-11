'use client';

import { useState, useEffect } from 'react';
import { CreateVaultForm } from '@/components/CreateVaultForm';
import { getAllVaults } from '@/lib/storage';
import type { Vault } from '@/types/vault';
import Link from 'next/link';

export default function Home() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Set current time on client to avoid hydration mismatch
    setNow(Date.now());
    
    getAllVaults().then((v) => {
      setVaults(v);
      setLoading(false);
    });
  }, []);

  const handleVaultCreated = (vault: Vault) => {
    setVaults((prev) => [vault, ...prev]);
  };

  const isLocked = (unlockTime: number) => (now ?? 0) < unlockTime;

  return (
    <main className="min-h-screen py-12 px-4">
      {/* Header */}
      <header className="max-w-lg mx-auto text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600/20 mb-4">
          <svg
            className="w-8 h-8 text-violet-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">
          Time-Locked Vault
        </h1>
        <p className="text-zinc-400">
          Lock any secret until a specific time. Fully decentralized, 
          encrypted on your device.
        </p>
      </header>

      {/* Create vault form */}
      <CreateVaultForm onVaultCreated={handleVaultCreated} />

      {/* Existing vaults */}
      {!loading && vaults.length > 0 && (
        <section className="max-w-lg mx-auto mt-12">
          <h2 className="text-lg font-semibold text-zinc-300 mb-4">
            Your Vaults
          </h2>
          <div className="space-y-3">
            {vaults.map((vault) => (
              <Link
                key={vault.id}
                href={`/vault/${vault.id}`}
                className="
                  block p-4 rounded-xl
                  bg-zinc-900 border border-zinc-800
                  hover:border-zinc-700 transition-colors
                "
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`
                        w-10 h-10 rounded-lg flex items-center justify-center
                        ${isLocked(vault.unlockTime) 
                          ? 'bg-amber-500/20' 
                          : 'bg-emerald-500/20'}
                      `}
                    >
                      <svg
                        className={`w-5 h-5 ${
                          isLocked(vault.unlockTime) 
                            ? 'text-amber-400' 
                            : 'text-emerald-400'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {isLocked(vault.unlockTime) ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                          />
                        )}
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100 truncate">
                        {vault.fileName || `Vault ${vault.id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {isLocked(vault.unlockTime)
                          ? `Unlocks ${new Date(vault.unlockTime).toLocaleDateString()}`
                          : 'Ready to unlock'}
                      </p>
                    </div>
                  </div>
                  <svg
                    className="w-5 h-5 text-zinc-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="max-w-lg mx-auto mt-16 text-center">
        <p className="text-xs text-zinc-600">
          Powered by IPFS + Lit Protocol. No servers, no backdoors.
        </p>
      </footer>
    </main>
  );
}
