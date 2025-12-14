'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { VaultCountdown } from '@/components/VaultCountdown';
import { getVaultRef, VaultRef } from '@/lib/storage';
import { fetchFromIPFS } from '@/lib/ipfs';
import { initLit, decryptKey, isUnlockable } from '@/lib/lit';
import { importKey, decryptToString } from '@/lib/crypto';
import { decodeVaultFromHash } from '@/lib/share';
import { useToast } from '@/components/Toast';
import { getFriendlyError } from '@/lib/errors';

type State = 'loading' | 'not_found' | 'locked' | 'ready' | 'unlocking' | 'unlocked' | 'error';

export default function VaultPage() {
  const params = useParams();
  const id = params.id as string;
  const [state, setState] = useState<State>('loading');
  const [vault, setVault] = useState<VaultRef | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [decryptedSecret, setDecryptedSecret] = useState<string | null>(null);
  const [isSharedLink, setIsSharedLink] = useState(false);
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    const loadVault = async () => {
      // First try localStorage
      const localVault = await getVaultRef(id);
      if (localVault) {
        setVault(localVault);
        setState(isUnlockable(localVault.unlockTime) ? 'ready' : 'locked');
        return;
      }

      // Then try URL hash (shared link)
      const hash = window.location.hash;
      const sharedVault = decodeVaultFromHash(hash, id);
      if (sharedVault) {
        setVault(sharedVault);
        setIsSharedLink(true);
        setState(isUnlockable(sharedVault.unlockTime) ? 'ready' : 'locked');
        return;
      }

      // Not found anywhere
      setState('not_found');
    };

    loadVault();
  }, [id]);

  const handleUnlock = async () => {
    if (!vault) return;

    setState('unlocking');
    setError(null);

    try {
      // Connect to Lit
      setProgress('Connecting to Lit Network...');
      await initLit();

      // Get decryption key from Lit
      setProgress('Retrieving decryption key...');
      const rawKey = await decryptKey(
        vault.litEncryptedKey,
        vault.litKeyHash,
        vault.unlockTime,
      );

      // Fetch encrypted data from IPFS
      setProgress('Fetching from IPFS...');
      const encryptedData = await fetchFromIPFS(vault.cid);

      // Import key and decrypt
      setProgress('Decrypting...');
      const symmetricKey = await importKey(rawKey);
      const secret = await decryptToString(encryptedData, symmetricKey);

      setDecryptedSecret(secret);
      setState('unlocked');
    } catch (err) {
      console.error('Unlock error:', err);
      const friendlyError = getFriendlyError(err instanceof Error ? err : new Error(String(err)));
      setError(friendlyError.message);
      setState('error');
    }
  };

  // Loading
  if (state === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
      </main>
    );
  }

  // Not found
  if (state === 'not_found') {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-zinc-100 mb-2">Vault Not Found</h1>
          <p className="text-sm text-zinc-400 mb-6">
            This vault doesn&apos;t exist. Make sure you have the complete shareable link.
          </p>
          <Link href="/" className="inline-flex px-6 py-3 rounded-lg font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors">
            Create a Vault
          </Link>
        </div>
      </main>
    );
  }

  // Error
  if (state === 'error') {
    return (
      <main className="min-h-screen py-12 px-4">
        <div className="max-w-lg mx-auto mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>
        <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-zinc-100 mb-2">Unlock Failed</h1>
          <p className="text-sm text-red-400 mb-6">{error}</p>
          <button
            onClick={() => setState('ready')}
            className="px-6 py-3 rounded-lg font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  // Locked - show countdown
  if (state === 'locked' && vault) {
    return (
      <main className="min-h-screen py-12 px-4">
        <div className="max-w-lg mx-auto mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>
        <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-100 mb-2 text-center">
            Time-Locked Vault
          </h2>
          <VaultCountdown
            unlockTime={vault.unlockTime}
            onUnlockReady={() => setState('ready')}
          />
          <div className="mt-6 pt-4 border-t border-zinc-800 text-center">
            <a
              href={`https://ipfs.io/ipfs/${vault.cid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View encrypted data on IPFS
            </a>
          </div>
        </div>
      </main>
    );
  }

  // Ready to unlock
  if (state === 'ready' && vault) {
    return (
      <main className="min-h-screen py-12 px-4">
        <div className="max-w-lg mx-auto mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>
        <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Ready to Unlock</h2>
          <p className="text-sm text-zinc-400 mb-6">
            This vault can now be opened. Click below to decrypt.
          </p>
          <button
            onClick={handleUnlock}
            className="w-full py-3 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors animate-pulse-glow"
          >
            Unlock Vault
          </button>
        </div>
      </main>
    );
  }

  // Unlocking
  if (state === 'unlocking') {
    return (
      <main className="min-h-screen py-12 px-4">
        <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
          <div className="animate-spin w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Unlocking Vault</h2>
          <p className="text-sm text-zinc-400">{progress}</p>
        </div>
      </main>
    );
  }

  // Unlocked
  return (
    <>
    {ToastComponent}
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-lg mx-auto mb-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
      </div>
      <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Vault Unlocked</h2>
            <p className="text-xs text-zinc-500">Decrypted successfully</p>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-zinc-800 border border-zinc-700">
          <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">{decryptedSecret}</p>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              navigator.clipboard.writeText(decryptedSecret || '');
              showToast('Secret copied!');
            }}
            className="flex-1 py-3 rounded-lg font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
          >
            Copy Secret
          </button>
          <Link href="/" className="flex-1 py-3 rounded-lg font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors text-center">
            Create Vault
          </Link>
        </div>
        {vault && (
          <div className="mt-4 pt-4 border-t border-zinc-800 text-center">
            <a
              href={`https://ipfs.io/ipfs/${vault.cid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View encrypted data on IPFS
            </a>
          </div>
        )}
      </div>
    </main>
    </>
  );
}

