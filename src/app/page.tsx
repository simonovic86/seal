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
        <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
          Time-Locked Vault
        </h1>
        <p className="text-sm text-zinc-500">
          Lock any secret until a specific time
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
          <div className="space-y-2">
            {vaults.map((vault) => {
              const unlockable = isUnlockable(vault.unlockTime);
              return (
                <Link
                  key={vault.id}
                  href={`/vault/${vault.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200 truncate">
                      {vault.name || `Vault ${vault.id.slice(0, 8)}`}
                    </p>
                    <p className={`text-xs ${unlockable ? 'text-emerald-500' : 'text-zinc-500'}`}>
                      {unlockable
                        ? 'Ready'
                        : new Date(vault.unlockTime).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-zinc-600 text-sm">→</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="max-w-lg mx-auto mt-16 text-center">
        <p className="text-xs text-zinc-600">
          Encrypted in browser · Time-locked by{' '}
          <a
            href="https://litprotocol.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-zinc-300 underline"
          >
            Lit Protocol
          </a>
        </p>
      </footer>
    </main>
    </>
  );
}
