'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { VaultCountdown } from '@/components/VaultCountdown';
import { getVaultRef, VaultRef } from '@/lib/storage';
import { fetchFromIPFS, fromBase64 } from '@/lib/ipfs';
import { initLit, decryptKey, isUnlockable } from '@/lib/lit';
import { importKey, decryptToString } from '@/lib/crypto';
import { decodeVaultFromHash } from '@/lib/share';
import { useToast } from '@/components/Toast';
import { QRCodeModal } from '@/components/QRCode';
import { getFriendlyError } from '@/lib/errors';
import { getShareableUrl } from '@/lib/share';

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
  const [showQR, setShowQR] = useState(false);
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

      // Get encrypted data (inline from URL or fetch from IPFS)
      let encryptedData: Uint8Array;
      if (vault.inlineData) {
        setProgress('Loading encrypted data...');
        encryptedData = fromBase64(vault.inlineData);
      } else {
        setProgress('Fetching from IPFS...');
        encryptedData = await fetchFromIPFS(vault.cid);
      }

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
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Back
          </Link>
        </div>
        <div className="max-w-lg mx-auto p-6 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
          <p className="text-sm text-zinc-500 mb-4">Locked</p>
          <VaultCountdown
            unlockTime={vault.unlockTime}
            onUnlockReady={() => setState('ready')}
          />
          
          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={() => setShowQR(true)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Share
            </button>
            {vault.cid && !vault.inlineData && (
              <a
                href={`https://explore.ipld.io/#/explore/${vault.cid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Verify
              </a>
            )}
          </div>
        </div>
        <QRCodeModal
          url={getShareableUrl(vault)}
          isOpen={showQR}
          onClose={() => setShowQR(false)}
        />
      </main>
    );
  }

  // Ready to unlock
  if (state === 'ready' && vault) {
    return (
      <main className="min-h-screen py-12 px-4">
        <div className="max-w-lg mx-auto mb-8">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Back
          </Link>
        </div>
        <div className="max-w-lg mx-auto p-6 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
          <p className="text-sm text-emerald-500 mb-6">Ready to unlock</p>
          <button
            onClick={handleUnlock}
            className="w-full py-3 rounded-lg font-medium bg-zinc-100 text-zinc-900 hover:bg-white transition-colors"
          >
            Unlock
          </button>
        </div>
        <QRCodeModal
          url={getShareableUrl(vault)}
          isOpen={showQR}
          onClose={() => setShowQR(false)}
        />
      </main>
    );
  }

  // Unlocking
  if (state === 'unlocking') {
    return (
      <main className="min-h-screen py-12 px-4">
        <div className="max-w-lg mx-auto p-8 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
          <div className="w-6 h-6 mx-auto mb-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
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
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Back
        </Link>
      </div>
      <div className="max-w-lg mx-auto p-6 rounded-xl bg-zinc-900 border border-zinc-800">
        <p className="text-xs text-zinc-500 mb-3">Your secret</p>
        <div className="p-4 rounded-lg bg-zinc-800">
          <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">{decryptedSecret}</p>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(decryptedSecret || '');
            showToast('Copied');
          }}
          className="w-full mt-4 py-2.5 rounded-lg font-medium bg-zinc-100 text-zinc-900 hover:bg-white transition-colors text-sm"
        >
          Copy
        </button>
        <Link 
          href="/" 
          className="block mt-3 text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Create another
        </Link>
      </div>
      
      {/* Footer */}
      <footer className="max-w-lg mx-auto mt-12 text-center">
        <p className="text-xs text-zinc-600">
          Powered by{' '}
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

