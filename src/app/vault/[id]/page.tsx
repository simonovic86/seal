'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { UnlockVault } from '@/components/UnlockVault';
import { getVault } from '@/lib/storage';
import type { Vault } from '@/types/vault';

interface VaultPageProps {
  params: Promise<{ id: string }>;
}

export default function VaultPage({ params }: VaultPageProps) {
  const { id } = use(params);
  const [vault, setVault] = useState<Vault | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getVault(id).then((v) => {
      if (v) {
        setVault(v);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-zinc-100 mb-2">
            Vault Not Found
          </h1>
          <p className="text-sm text-zinc-400 mb-6">
            This vault doesn&apos;t exist or was created on another device.
          </p>
          <Link
            href="/"
            className="
              inline-flex px-6 py-3 rounded-lg font-medium
              bg-violet-600 text-white hover:bg-violet-500
              transition-colors
            "
          >
            Go Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-12 px-4">
      {/* Back link */}
      <div className="max-w-lg mx-auto mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to vaults
        </Link>
      </div>

      {/* Vault content */}
      {vault && <UnlockVault vault={vault} />}
    </main>
  );
}

