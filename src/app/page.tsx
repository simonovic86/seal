'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CreateVaultForm } from '@/components/CreateVaultForm';
import { useToast } from '@/components/Toast';
import { getAllVaultRefs, VaultRef } from '@/lib/storage';
import { isUnlockable } from '@/lib/lit';
import { encodeBackupUrl } from '@/lib/share';

export default function Home() {
  const [vaults, setVaults] = useState<VaultRef[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    getAllVaultRefs().then((v) => {
      setVaults(v);
      setLoading(false);
    });
  }, []);

  const handleVaultCreated = (vault: VaultRef) => {
    setVaults((prev) => [vault, ...prev]);
  };

  const handleBackup = async () => {
    const backupUrl = encodeBackupUrl(vaults);
    await navigator.clipboard.writeText(backupUrl);
    showToast('Backup link copied!');
  };

  return (
    <>
    {ToastComponent}
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
          Lock any secret until a specific time. Encrypted on your device,
          stored on IPFS, time-locked via Lit Protocol.
        </p>
      </header>

      {/* Create vault form */}
      <CreateVaultForm onVaultCreated={handleVaultCreated} />

      {/* Saved vaults */}
      {!loading && vaults.length > 0 && (
        <section className="max-w-lg mx-auto mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-300">
              Your Vaults
            </h2>
            <button
              onClick={handleBackup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Backup
            </button>
          </div>
          <div className="space-y-3">
            {vaults.map((vault) => {
              const unlockable = isUnlockable(vault.unlockTime);
              return (
                <Link
                  key={vault.id}
                  href={`/vault/${vault.id}`}
                  className="block p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          unlockable ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                        }`}
                      >
                        <svg
                          className={`w-5 h-5 ${unlockable ? 'text-emerald-400' : 'text-amber-400'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          {unlockable ? (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                            />
                          ) : (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          )}
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-100 truncate">
                          {vault.name || `Vault ${vault.id.slice(0, 8)}`}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {unlockable
                            ? 'Ready to unlock'
                            : `Unlocks ${new Date(vault.unlockTime).toLocaleDateString()}`}
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
              );
            })}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <p className="text-xs text-zinc-500">
          No accounts. No servers. Encrypted in your browser.
        </p>
        <p className="text-xs text-zinc-600">
          We keep nothing. Verify everything.
        </p>
        
        {/* Powered by Lit Protocol badge */}
        <a
          href="https://litprotocol.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 hover:border-violet-500/40 transition-all group"
        >
          <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-xs font-medium bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent group-hover:from-violet-300 group-hover:to-fuchsia-300 transition-all">
            Powered by Lit Protocol
          </span>
        </a>
      </footer>
    </main>
    </>
  );
}
