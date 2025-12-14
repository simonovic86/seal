'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TimeSelector } from './TimeSelector';
import { useToast } from './Toast';
import { generateKey, exportKey, encrypt } from '@/lib/crypto';
import { initLit, encryptKeyWithTimelock } from '@/lib/lit';
import { uploadToIPFS } from '@/lib/ipfs';
import { saveVaultRef, VaultRef } from '@/lib/storage';
import { getShareableUrl } from '@/lib/share';
import { getFriendlyError } from '@/lib/errors';

interface CreateVaultFormProps {
  onVaultCreated?: (vault: VaultRef) => void;
}

type Step = 'input' | 'creating' | 'done';

export function CreateVaultForm({ onVaultCreated }: CreateVaultFormProps) {
  const [secretText, setSecretText] = useState('');
  const [unlockTime, setUnlockTime] = useState<Date | null>(null);
  const [step, setStep] = useState<Step>('input');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [createdVault, setCreatedVault] = useState<VaultRef | null>(null);
  const { showToast, ToastComponent } = useToast();

  const hasContent = secretText.trim();
  const canCreate = hasContent && unlockTime;

  const handleCreate = async () => {
    if (!canCreate || !unlockTime) return;

    setError(null);
    setStep('creating');

    try {
      // Initialize Lit Protocol
      setProgress('Connecting to Lit Network...');
      await initLit();

      // Encrypt the secret
      setProgress('Encrypting your secret...');
      const symmetricKey = await generateKey();
      const encryptedData = await encrypt(secretText, symmetricKey);
      const rawKey = await exportKey(symmetricKey);

      // Upload to IPFS
      setProgress('Uploading to IPFS...');
      const cid = await uploadToIPFS(encryptedData);

      // Store key in Lit with time condition
      setProgress('Securing with time-lock...');
      const unlockTimeMs = unlockTime.getTime();
      const { encryptedKey, encryptedKeyHash } = await encryptKeyWithTimelock(
        rawKey,
        unlockTimeMs,
      );

      // Create vault reference
      const vault: VaultRef = {
        id: uuidv4(),
        cid,
        unlockTime: unlockTimeMs,
        litEncryptedKey: encryptedKey,
        litKeyHash: encryptedKeyHash,
        createdAt: Date.now(),
      };

      // Save locally for easy access
      setProgress('Saving vault...');
      await saveVaultRef(vault);

      setCreatedVault(vault);
      setStep('done');
      onVaultCreated?.(vault);
    } catch (err) {
      console.error('Vault creation error:', err);
      const friendlyError = getFriendlyError(err instanceof Error ? err : new Error(String(err)));
      setError(friendlyError.message);
      setStep('input');
    }
  };

  const handleReset = () => {
    setSecretText('');
    setUnlockTime(null);
    setStep('input');
    setCreatedVault(null);
    setProgress('');
    setError(null);
  };

  const getVaultUrl = () => {
    if (!createdVault) return '';
    return getShareableUrl(createdVault);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getVaultUrl());
    showToast('Link copied!');
  };

  // Success state
  if (step === 'done' && createdVault) {
    return (
      <>
      {ToastComponent}
      <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">
          Vault Created!
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Your secret is locked until {unlockTime?.toLocaleString()}
        </p>

        <div className="p-4 rounded-lg bg-zinc-800 mb-6 text-left">
          <p className="text-xs text-zinc-500 mb-1">Shareable Link</p>
          <code className="text-sm text-violet-400 break-all">
            {getVaultUrl()}
          </code>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 py-3 rounded-lg font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
          >
            Copy Link
          </button>
          <button
            onClick={handleReset}
            className="flex-1 py-3 rounded-lg font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Create Another
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 mb-2">
            Your encrypted data is stored publicly on IPFS. We keep nothing.
          </p>
          <a
            href={`https://gateway.pinata.cloud/ipfs/${createdVault.cid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View encrypted data on IPFS
          </a>
        </div>
      </div>
      </>
    );
  }

  // Creating state
  if (step === 'creating') {
    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center animate-fade-in">
        <div className="animate-spin w-12 h-12 border-3 border-violet-500 border-t-transparent rounded-full mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">
          Creating Vault
        </h2>
        <p className="text-sm text-zinc-400">{progress}</p>
      </div>
    );
  }

  // Input form
  return (
    <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
      <h2 className="text-xl font-semibold text-zinc-100 mb-6">
        Lock Your Secret
      </h2>

      <div className="space-y-6">
        {/* Text input */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Secret message
          </label>
          <textarea
            value={secretText}
            onChange={(e) => setSecretText(e.target.value)}
            placeholder="Enter your secret..."
            rows={4}
            className="
              w-full px-4 py-3 rounded-lg resize-none
              bg-zinc-800 border border-zinc-700
              text-zinc-100 placeholder-zinc-500
              focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
            "
          />
        </div>

        {/* Time selector */}
        <TimeSelector value={unlockTime} onChange={setUnlockTime} />

        {/* Error */}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Submit */}
        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className="
            w-full py-3 rounded-lg font-medium
            bg-violet-600 text-white
            hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
        >
          Lock Secret
        </button>
      </div>
    </div>
  );
}
