'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TimeSelector } from './TimeSelector';
import { FileUpload } from './FileUpload';
import { generateKey, exportKey, encrypt } from '@/lib/crypto';
import { hasActiveSpace, loginWithEmail, uploadEncryptedBlob } from '@/lib/ipfs';
import { initLit, encryptKeyWithTimelock } from '@/lib/lit';
import { saveVault } from '@/lib/storage';
import type { Vault } from '@/types/vault';

interface CreateVaultFormProps {
  onVaultCreated?: (vault: Vault) => void;
}

type Step = 'input' | 'auth' | 'creating' | 'done';

export function CreateVaultForm({ onVaultCreated }: CreateVaultFormProps) {
  const [secretText, setSecretText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [unlockTime, setUnlockTime] = useState<Date | null>(null);
  const [step, setStep] = useState<Step>('input');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [createdVault, setCreatedVault] = useState<Vault | null>(null);

  // IPFS auth state
  const [email, setEmail] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const hasContent = secretText.trim() || selectedFile;
  const canCreate = hasContent && unlockTime;

  const handleAuth = async () => {
    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    setError(null);
    setIsAuthenticating(true);

    try {
      await loginWithEmail(email);
      // Auth successful, proceed with vault creation
      setStep('input');
      await doCreate();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Authentication failed',
      );
      setIsAuthenticating(false);
    }
  };

  const doCreate = async () => {
    if (!canCreate || !unlockTime) return;

    setStep('creating');
    setError(null);

    try {
      // Initialize Lit Protocol
      setProgress('Connecting to Lit Network...');
      await initLit();

      // Prepare data
      setProgress('Encrypting your secret...');
      let dataToEncrypt: ArrayBuffer | string;
      let isFile = false;
      let fileName: string | undefined;
      let mimeType: string | undefined;

      if (selectedFile) {
        dataToEncrypt = await selectedFile.arrayBuffer();
        isFile = true;
        fileName = selectedFile.name;
        mimeType = selectedFile.type;
      } else {
        dataToEncrypt = secretText;
      }

      // Generate key and encrypt
      const symmetricKey = await generateKey();
      const encryptedData = await encrypt(dataToEncrypt, symmetricKey);
      const rawKey = await exportKey(symmetricKey);

      // Upload to IPFS
      setProgress('Uploading to IPFS...');
      const cid = await uploadEncryptedBlob(encryptedData);

      // Store key in Lit with time condition
      setProgress('Securing key with time-lock...');
      const unlockTimeMs = unlockTime.getTime();
      const { encryptedKey, encryptedKeyHash } = await encryptKeyWithTimelock(
        rawKey,
        unlockTimeMs,
      );

      // Create vault record
      const vault: Vault = {
        id: uuidv4(),
        cid,
        unlockTime: unlockTimeMs,
        litEncryptedKey: encryptedKey,
        litEncryptedKeyHash: encryptedKeyHash,
        createdAt: Date.now(),
        isFile,
        fileName,
        mimeType,
      };

      // Save locally
      setProgress('Saving vault...');
      await saveVault(vault);

      setCreatedVault(vault);
      setStep('done');
      onVaultCreated?.(vault);
    } catch (err) {
      console.error('Vault creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create vault');
      setStep('input');
    }
  };

  const handleCreate = async () => {
    if (!canCreate) return;

    setError(null);

    try {
      // Check IPFS auth
      const hasSpace = await hasActiveSpace();
      if (!hasSpace) {
        setStep('auth');
        return;
      }

      await doCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vault');
    }
  };

  const handleReset = () => {
    setSecretText('');
    setSelectedFile(null);
    setUnlockTime(null);
    setStep('input');
    setCreatedVault(null);
    setProgress('');
    setError(null);
  };

  // Auth dialog
  if (step === 'auth') {
    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-100 mb-4">
          Connect to IPFS Storage
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Enter your email to authenticate with web3.storage.
          You&apos;ll receive a verification link — click it to continue.
        </p>

        {!isAuthenticating ? (
          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="
                w-full px-4 py-3 rounded-lg
                bg-zinc-800 border border-zinc-700
                text-zinc-100 placeholder-zinc-500
                focus:outline-none focus:ring-2 focus:ring-violet-500
              "
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
            />
            <button
              onClick={handleAuth}
              className="
                w-full py-3 rounded-lg font-medium
                bg-violet-600 text-white hover:bg-violet-500
                transition-colors
              "
            >
              Send Verification Email
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-zinc-300 mb-2">Check your email</p>
            <p className="text-sm text-zinc-500">
              Click the verification link to continue...
            </p>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <button
          onClick={() => {
            setStep('input');
            setIsAuthenticating(false);
          }}
          className="mt-4 text-sm text-zinc-500 hover:text-zinc-300"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Success state
  if (step === 'done' && createdVault) {
    const vaultUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/vault/${createdVault.id}`;

    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
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
          Your secret is locked until{' '}
          {new Date(createdVault.unlockTime).toLocaleString()}
        </p>

        <div className="p-4 rounded-lg bg-zinc-800 mb-4">
          <p className="text-xs text-zinc-500 mb-1">IPFS CID</p>
          <code className="text-xs text-zinc-400 break-all">
            {createdVault.cid}
          </code>
        </div>

        <div className="p-4 rounded-lg bg-zinc-800 mb-6">
          <p className="text-xs text-zinc-500 mb-1">Vault URL</p>
          <code className="text-sm text-violet-400 break-all">{vaultUrl}</code>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigator.clipboard.writeText(vaultUrl)}
            className="
              flex-1 py-3 rounded-lg font-medium
              bg-violet-600 text-white hover:bg-violet-500
              transition-colors
            "
          >
            Copy Link
          </button>
          <button
            onClick={handleReset}
            className="
              flex-1 py-3 rounded-lg font-medium
              bg-zinc-800 text-zinc-300 hover:bg-zinc-700
              transition-colors
            "
          >
            Create Another
          </button>
        </div>
      </div>
    );
  }

  // Creating state
  if (step === 'creating') {
    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
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
            Secret text
          </label>
          <textarea
            value={secretText}
            onChange={(e) => setSecretText(e.target.value)}
            placeholder="Enter your secret message..."
            rows={4}
            disabled={!!selectedFile}
            className="
              w-full px-4 py-3 rounded-lg resize-none
              bg-zinc-800 border border-zinc-700
              text-zinc-100 placeholder-zinc-500
              focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          />
        </div>

        {/* File upload */}
        <FileUpload
          selectedFile={selectedFile}
          onFileSelect={(file) => {
            setSelectedFile(file);
            if (file) setSecretText('');
          }}
        />

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
