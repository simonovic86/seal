'use client';

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TimeSelector } from './TimeSelector';
import { useToast } from './Toast';
import { QRCodeModal } from './QRCode';
import { Turnstile } from './Turnstile';
import { generateKey, exportKey, encrypt } from '@/lib/crypto';
import { initLit, encryptKeyWithTimelock } from '@/lib/lit';
import { uploadToIPFS, shouldUseInlineStorage, toBase64 } from '@/lib/ipfs';
import { saveVaultRef, VaultRef, INLINE_DATA_THRESHOLD } from '@/lib/storage';
import { getShareableUrl } from '@/lib/share';
import { getFriendlyError } from '@/lib/errors';

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
  { id: 'captcha', label: 'Verifying human', endpoint: 'cloudflare.com' },
  { id: 'encrypt', label: 'Encrypting in your browser', endpoint: 'local' },
  { id: 'lit', label: 'Connecting to Lit Protocol', endpoint: 'litprotocol.com' },
  { id: 'ipfs', label: 'Storing encrypted data', endpoint: 'URL or IPFS' },
  { id: 'timelock', label: 'Applying time-lock', endpoint: 'litprotocol.com' },
  { id: 'save', label: 'Saving locally', endpoint: 'local' },
];

export function CreateVaultForm({ onVaultCreated }: CreateVaultFormProps) {
  const [secretText, setSecretText] = useState('');
  const [unlockTime, setUnlockTime] = useState<Date | null>(null);
  const [step, setStep] = useState<Step>('input');
  const [error, setError] = useState<string | null>(null);
  const [currentProgressStep, setCurrentProgressStep] = useState<string>('');
  const [createdVault, setCreatedVault] = useState<VaultRef | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();

  const hasContent = secretText.trim();
  const hasCaptcha = !!captchaToken;
  const canCreate = hasContent && unlockTime && hasCaptcha;

  // Estimate storage mode (encrypted data is ~1.5x larger due to IV + base64)
  const estimatedSize = new TextEncoder().encode(secretText).length * 1.5;
  const willUseIPFS = estimatedSize > INLINE_DATA_THRESHOLD;
  const hasPinataKey = !!process.env.NEXT_PUBLIC_PINATA_JWT;

  const handleCaptchaVerify = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  const handleCaptchaExpire = useCallback(() => {
    setCaptchaToken(null);
  }, []);

  const handleCreate = async () => {
    if (!canCreate || !unlockTime) return;

    setError(null);
    setStep('creating');

    // Helper to ensure minimum display time for each step
    const minDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      // Verify CAPTCHA server-side
      setCurrentProgressStep('captcha');
      const captchaResponse = await fetch('/api/verify-captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: captchaToken }),
      });
      
      if (!captchaResponse.ok) {
        throw new Error('CAPTCHA verification failed. Please try again.');
      }
      await minDelay(400);

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

      // Decide storage method: inline (URL) vs IPFS
      const useInline = shouldUseInlineStorage(encryptedData);
      let cid = '';
      let inlineData: string | undefined;

      if (useInline) {
        // Store encrypted data directly in URL (no IPFS needed)
        setCurrentProgressStep('ipfs'); // Still show step for consistency
        inlineData = toBase64(encryptedData);
        await minDelay(400); // Quick since no network call
      } else {
        // Upload to IPFS for larger vaults
        setCurrentProgressStep('ipfs');
        const [uploadedCid] = await Promise.all([
          uploadToIPFS(encryptedData),
          minDelay(600),
        ]);
        cid = uploadedCid;
      }

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
        cid,
        unlockTime: unlockTimeMs,
        litEncryptedKey: encryptedKey,
        litKeyHash: encryptedKeyHash,
        createdAt: Date.now(),
        inlineData,
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
    setSecretText('');
    setUnlockTime(null);
    setStep('input');
    setCreatedVault(null);
    setCurrentProgressStep('');
    setError(null);
    setShowQR(false);
    setCaptchaToken(null);
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
      <div className="max-w-lg mx-auto p-6 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
        <p className="text-sm text-zinc-300 mb-1">Locked until</p>
        <p className="text-lg text-zinc-100 mb-6">
          {unlockTime?.toLocaleString()}
        </p>

        <div className="p-3 rounded-lg bg-zinc-800 mb-4">
          <code className="text-xs text-zinc-400 break-all">
            {getVaultUrl()}
          </code>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 rounded-lg font-medium bg-zinc-100 text-zinc-900 hover:bg-white transition-colors text-sm"
          >
            Copy Link
          </button>
          <button
            onClick={() => setShowQR(true)}
            className="py-2.5 px-3 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="QR Code"
          >
            QR
          </button>
        </div>
        
        <button
          onClick={handleReset}
          className="mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Create another
        </button>

        <QRCodeModal
          url={getVaultUrl()}
          isOpen={showQR}
          onClose={() => setShowQR(false)}
        />
      </div>
      </>
    );
  }

  // Creating state
  if (step === 'creating') {
    const currentStep = PROGRESS_STEPS.find(s => s.id === currentProgressStep);
    
    return (
      <div className="max-w-lg mx-auto p-8 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
        <div className="w-6 h-6 mx-auto mb-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-zinc-300">
          {currentStep?.label || 'Creating vault...'}
        </p>
        <p className="text-xs text-zinc-600 mt-1">
          {currentStep?.endpoint && currentStep.endpoint !== 'local' 
            ? `→ ${currentStep.endpoint}` 
            : 'Processing locally'}
        </p>
      </div>
    );
  }

  // Input form
  return (
    <div className="max-w-lg mx-auto p-6 rounded-xl bg-zinc-900 border border-zinc-800">
      <div className="space-y-5">
        {/* Text input */}
        <div>
          <textarea
            value={secretText}
            onChange={(e) => setSecretText(e.target.value)}
            placeholder="Enter your secret..."
            rows={4}
            className="w-full px-4 py-3 rounded-lg resize-none bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          {hasContent && (
            <p className="mt-1.5 text-xs text-zinc-600">
              {willUseIPFS ? (
                hasPinataKey ? (
                  'Will be stored on IPFS'
                ) : (
                  <span className="text-amber-500">Large content requires Pinata API key</span>
                )
              ) : (
                'Will be stored in shareable link'
              )}
            </p>
          )}
        </div>

        {/* Time selector */}
        <TimeSelector value={unlockTime} onChange={setUnlockTime} />

        {/* CAPTCHA */}
        <div>
          <Turnstile
            onVerify={handleCaptchaVerify}
            onExpire={handleCaptchaExpire}
          />
        </div>

        {/* Error */}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Submit */}
        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className="w-full py-3 rounded-lg font-medium bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Lock
        </button>
      </div>
    </div>
  );
}
