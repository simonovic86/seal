'use client';

import { useState } from 'react';
import { VaultCountdown } from './VaultCountdown';
import { fetchBlob } from '@/lib/ipfs';
import { initLit, decryptKey, isUnlockable } from '@/lib/lit';
import { importKey, decrypt, decryptToString } from '@/lib/crypto';
import type { Vault, DecryptedVault } from '@/types/vault';

interface UnlockVaultProps {
  vault: Vault;
}

type State = 'locked' | 'ready' | 'unlocking' | 'unlocked' | 'error';

export function UnlockVault({ vault }: UnlockVaultProps) {
  const [state, setState] = useState<State>(
    isUnlockable(vault.unlockTime) ? 'ready' : 'locked',
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [decrypted, setDecrypted] = useState<DecryptedVault | null>(null);

  const handleUnlock = async () => {
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
        vault.litEncryptedKeyHash,
        vault.unlockTime,
      );

      // Import key
      const symmetricKey = await importKey(rawKey);

      // Fetch encrypted data from IPFS
      setProgress('Fetching encrypted data...');
      const encryptedData = await fetchBlob(vault.cid);

      // Decrypt
      setProgress('Decrypting...');
      let content: string | ArrayBuffer;

      if (vault.isFile) {
        content = await decrypt(encryptedData, symmetricKey);
      } else {
        content = await decryptToString(encryptedData, symmetricKey);
      }

      setDecrypted({
        content,
        isFile: vault.isFile,
        fileName: vault.fileName,
        mimeType: vault.mimeType,
      });
      setState('unlocked');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock vault');
      setState('error');
    }
  };

  const handleDownload = () => {
    if (!decrypted || !decrypted.isFile) return;

    const blob = new Blob([decrypted.content as ArrayBuffer], {
      type: decrypted.mimeType || 'application/octet-stream',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = decrypted.fileName || 'decrypted-file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Locked - show countdown
  if (state === 'locked') {
    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-100 mb-2 text-center">
          {vault.fileName || 'Time-Locked Vault'}
        </h2>
        <VaultCountdown
          unlockTime={vault.unlockTime}
          onUnlockReady={() => setState('ready')}
        />
      </div>
    );
  }

  // Ready to unlock
  if (state === 'ready') {
    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">
          {vault.fileName || 'Time-Locked Vault'}
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          This vault is ready to be unlocked. You&apos;ll need to sign a message to prove your identity.
        </p>
        <button
          onClick={handleUnlock}
          className="
            w-full py-3 rounded-lg font-medium
            bg-emerald-600 text-white hover:bg-emerald-500
            transition-colors
          "
        >
          Unlock Vault
        </button>
      </div>
    );
  }

  // Unlocking in progress
  if (state === 'unlocking') {
    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
        <div className="animate-spin w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">
          Unlocking Vault
        </h2>
        <p className="text-sm text-zinc-400">{progress}</p>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">
          Unlock Failed
        </h2>
        <p className="text-sm text-red-400 mb-6">{error}</p>
        <button
          onClick={() => setState('ready')}
          className="
            px-6 py-3 rounded-lg font-medium
            bg-zinc-800 text-zinc-300 hover:bg-zinc-700
            transition-colors
          "
        >
          Try Again
        </button>
      </div>
    );
  }

  // Unlocked - show content
  return (
    <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            Vault Unlocked
          </h2>
          <p className="text-xs text-zinc-500">
            Created {new Date(vault.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {decrypted?.isFile ? (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-zinc-800 border border-zinc-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-violet-600/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-100 truncate">
                  {decrypted.fileName || 'Decrypted File'}
                </p>
                <p className="text-xs text-zinc-500">
                  {decrypted.mimeType || 'Unknown type'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={handleDownload}
            className="
              w-full py-3 rounded-lg font-medium
              bg-violet-600 text-white hover:bg-violet-500
              transition-colors
            "
          >
            Download File
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-zinc-800 border border-zinc-700">
          <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">
            {decrypted?.content as string}
          </p>
        </div>
      )}
    </div>
  );
}

