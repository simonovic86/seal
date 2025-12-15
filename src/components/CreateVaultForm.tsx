'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TimeSelector } from './TimeSelector';
import { useToast } from './Toast';
import { QRCodeModal } from './QRCode';
import { generateKey, exportKey, encrypt } from '@/lib/crypto';
import { initLit, encryptKeyWithTimelock } from '@/lib/lit';
import { toBase64 } from '@/lib/encoding';
import { saveVaultRef, VaultRef } from '@/lib/storage';
import { getShareableUrl } from '@/lib/share';
import { getFriendlyError } from '@/lib/errors';

// Maximum vault size (must fit in URL)
const MAX_VAULT_SIZE = 32 * 1024; // 32KB

interface CreateVaultFormProps {
  onVaultCreated?: (vault: VaultRef) => void;
}

type Step = 'input' | 'creating' | 'done';

type ProgressStep = {
  id: string;
  label: string;
  endpoint?: string;
  status: 'pending' | 'active' | 'done';
};

const PROGRESS_STEPS: Omit<ProgressStep, 'status'>[] = [
  { id: 'encrypt', label: 'Encrypting in your browser', endpoint: 'local' },
  { id: 'lit', label: 'Connecting to Lit Protocol', endpoint: 'litprotocol.com' },
  { id: 'store', label: 'Preparing shareable link', endpoint: 'local' },
  { id: 'timelock', label: 'Applying time-lock', endpoint: 'litprotocol.com' },
  { id: 'save', label: 'Saving locally', endpoint: 'local' },
];

export function CreateVaultForm({ onVaultCreated }: CreateVaultFormProps) {
  const [vaultName, setVaultName] = useState('');
  const [secretText, setSecretText] = useState('');
  const [unlockTime, setUnlockTime] = useState<Date | null>(null);
  const [step, setStep] = useState<Step>('input');
  const [error, setError] = useState<string | null>(null);
  const [currentProgressStep, setCurrentProgressStep] = useState<string>('');
  const [createdVault, setCreatedVault] = useState<VaultRef | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [destroyAfterRead, setDestroyAfterRead] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const hasContent = secretText.trim();
  const canCreate = hasContent && unlockTime;

  // Estimate encrypted size (encrypted data is ~1.5x larger due to IV + base64)
  const estimatedSize = new TextEncoder().encode(secretText).length * 1.5;
  const tooLarge = estimatedSize > MAX_VAULT_SIZE;

  const handleCreate = async () => {
    if (!canCreate || !unlockTime) return;

    if (tooLarge) {
      setError(`Secret is too large. Maximum size is ${Math.floor(MAX_VAULT_SIZE / 1024)}KB.`);
      return;
    }

    setError(null);
    setStep('creating');

    // Helper to ensure minimum display time for each step
    const minDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      // Encrypt the secret locally
      setCurrentProgressStep('encrypt');
      const [symmetricKey] = await Promise.all([
        generateKey(),
        minDelay(600),
      ]);
      const encryptedData = await encrypt(secretText, symmetricKey);
      const rawKey = await exportKey(symmetricKey);

      // Initialize Lit Protocol
      setCurrentProgressStep('lit');
      await Promise.all([initLit(), minDelay(600)]);

      // Store encrypted data in URL (inline storage)
      setCurrentProgressStep('store');
      const inlineData = toBase64(encryptedData);
      await minDelay(400);

      // Store key in Lit with time condition
      setCurrentProgressStep('timelock');
      const unlockTimeMs = unlockTime.getTime();
      const [{ encryptedKey, encryptedKeyHash }] = await Promise.all([
        encryptKeyWithTimelock(rawKey, unlockTimeMs),
        minDelay(600),
      ]);

      // Create vault reference
      const vault: VaultRef = {
        id: uuidv4(),
        unlockTime: unlockTimeMs,
        litEncryptedKey: encryptedKey,
        litKeyHash: encryptedKeyHash,
        createdAt: Date.now(),
        name: vaultName.trim() || undefined,
        inlineData,
        destroyAfterRead,
      };

      // Save locally for easy access
      setCurrentProgressStep('save');
      await Promise.all([saveVaultRef(vault), minDelay(400)]);

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
    setVaultName('');
    setSecretText('');
    setUnlockTime(null);
    setStep('input');
    setCreatedVault(null);
    setCurrentProgressStep('');
    setError(null);
    setShowQR(false);
    setDestroyAfterRead(false);
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
          {createdVault.name ? `"${createdVault.name}"` : 'Vault'} Created!
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Your secret is locked until {unlockTime?.toLocaleString()}
          {createdVault.destroyAfterRead && (
            <span className="block mt-1 text-amber-400">
              ⚠ This vault will be destroyed after reading
            </span>
          )}
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
            onClick={() => setShowQR(true)}
            className="py-3 px-4 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
            title="Show QR Code"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </button>
        </div>
        
        <button
          onClick={handleReset}
          className="w-full mt-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Done — Create Another
        </button>

        <QRCodeModal
          url={getVaultUrl()}
          isOpen={showQR}
          onClose={() => setShowQR(false)}
        />

        {/* Verification badges */}
        <div className="mt-6 pt-4 border-t border-zinc-800">
          <div className="grid grid-cols-1 gap-2 text-left mb-4">
            <div className="flex items-center gap-2 text-xs">
              <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-zinc-400">Encrypted in your browser</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-zinc-400">Stored in shareable link (no external service)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-zinc-400">Time-locked via Lit Protocol</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-zinc-400">Zero server storage</span>
            </div>
          </div>
          <p className="text-xs text-zinc-600 text-center">
            No early access — not for anyone, including us.
          </p>
        </div>
      </div>
      </>
    );
  }

  // Creating state
  if (step === 'creating') {
    const getStepStatus = (stepId: string): 'pending' | 'active' | 'done' => {
      const stepIndex = PROGRESS_STEPS.findIndex(s => s.id === stepId);
      const currentIndex = PROGRESS_STEPS.findIndex(s => s.id === currentProgressStep);
      if (stepIndex < currentIndex) return 'done';
      if (stepIndex === currentIndex) return 'active';
      return 'pending';
    };

    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 animate-fade-in">
        <h2 className="text-xl font-semibold text-zinc-100 mb-6 text-center">
          Creating Vault
        </h2>
        
        <div className="space-y-3">
          {PROGRESS_STEPS.map((progressStep) => {
            const status = getStepStatus(progressStep.id);
            return (
              <div
                key={progressStep.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  status === 'active' 
                    ? 'bg-violet-500/10 border border-violet-500/30' 
                    : status === 'done'
                    ? 'bg-zinc-800/50'
                    : 'opacity-40'
                }`}
              >
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {status === 'done' ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : status === 'active' ? (
                    <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-zinc-600" />
                  )}
                </div>
                
                {/* Label and endpoint */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    status === 'active' ? 'text-zinc-100' : 
                    status === 'done' ? 'text-zinc-400' : 'text-zinc-500'
                  }`}>
                    {progressStep.label}
                  </p>
                  {progressStep.endpoint && (
                    <p className={`text-xs ${
                      status === 'active' ? 'text-violet-400' : 'text-zinc-600'
                    }`}>
                      → {progressStep.endpoint}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-zinc-500 text-center mt-6">
          No data is sent to our servers
        </p>
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
        {/* Vault name */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Vault name <span className="text-zinc-500 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={vaultName}
            onChange={(e) => setVaultName(e.target.value)}
            placeholder="e.g., Birthday message for Mom"
            maxLength={100}
            className="
              w-full px-4 py-3 rounded-lg
              bg-zinc-800 border border-zinc-700
              text-zinc-100 placeholder-zinc-500
              focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
            "
          />
        </div>

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
            className={`
              w-full px-4 py-3 rounded-lg resize-none
              bg-zinc-800 border
              text-zinc-100 placeholder-zinc-500
              focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
              ${tooLarge ? 'border-red-500' : 'border-zinc-700'}
            `}
          />
          {hasContent && (
            <p className={`mt-1.5 text-xs ${tooLarge ? 'text-red-400' : 'text-zinc-500'}`}>
              {tooLarge ? (
                `Too large! Maximum ${Math.floor(MAX_VAULT_SIZE / 1024)}KB (currently ~${Math.floor(estimatedSize / 1024)}KB)`
              ) : (
                'Will be stored in shareable link'
              )}
            </p>
          )}
        </div>

        {/* Time selector */}
        <TimeSelector value={unlockTime} onChange={setUnlockTime} />

        {/* Destroy after read toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={destroyAfterRead}
            onChange={(e) => setDestroyAfterRead(e.target.checked)}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-violet-600 focus:ring-violet-500 focus:ring-offset-0"
          />
          <div>
            <span className="text-sm text-zinc-300">Destroy after reading</span>
            <p className="text-xs text-zinc-500">Vault will be deleted after first unlock</p>
          </div>
        </label>

        {/* Error */}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Submit */}
        <button
          onClick={handleCreate}
          disabled={!canCreate || tooLarge}
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
