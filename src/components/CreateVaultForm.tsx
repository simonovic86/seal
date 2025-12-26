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
import styles from './CreateVaultForm.module.css';
import '@/styles/shared.css';

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
      <div className={`${styles.card} ${styles.cardCenter}`}>
        <div className={styles.iconContainerLg}>
          <svg
            className={styles.icon}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className={styles.successTitle}>
          {createdVault.name ? `"${createdVault.name}"` : 'Vault'} Created!
        </h2>
        <p className={styles.successMessage}>
          Your secret is locked until {unlockTime?.toLocaleString()}
          {createdVault.destroyAfterRead && (
            <span className={styles.destroyNotice}>
              This vault will be destroyed after reading
            </span>
          )}
        </p>

        <div className={styles.linkContainer}>
          <p className={styles.linkLabel}>Shareable Link</p>
          <code className={styles.linkText}>
            {getVaultUrl()}
          </code>
        </div>

        <div className={styles.buttonRow}>
          <button
            onClick={handleCopy}
            className={`btn-primary ${styles.buttonFlex}`}
          >
            Copy Link
          </button>
          <button
            onClick={() => setShowQR(true)}
            className={`btn-secondary ${styles.qrButton}`}
            title="Show QR Code"
          >
            <svg className={styles.qrIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </button>
        </div>
        
        <button
          onClick={handleReset}
          className={`btn-ghost ${styles.doneButton}`}
        >
          Done — Create Another
        </button>

        <QRCodeModal
          url={getVaultUrl()}
          isOpen={showQR}
          onClose={() => setShowQR(false)}
        />

        {/* Verification badges */}
        <div className={styles.verificationSection}>
          <div className={styles.verificationList}>
            <div className={styles.verificationItem}>
              <svg className={styles.checkIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className={styles.verificationText}>Encrypted in your browser</span>
            </div>
            <div className={styles.verificationItem}>
              <svg className={styles.checkIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className={styles.verificationText}>Stored in shareable link (no external service)</span>
            </div>
            <div className={styles.verificationItem}>
              <svg className={styles.checkIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className={styles.verificationText}>Time-locked via Lit Protocol</span>
            </div>
            <div className={styles.verificationItem}>
              <svg className={styles.checkIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className={styles.verificationText}>Zero server storage</span>
            </div>
          </div>
          <p className={styles.verificationFooter}>
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
      <div className={styles.card}>
        <h2 className={styles.progressTitle}>
          Creating Vault
        </h2>
        
        <div className={styles.progressSteps}>
          {PROGRESS_STEPS.map((progressStep) => {
            const status = getStepStatus(progressStep.id);
            const stepClass = status === 'active' 
              ? styles.progressStepActive 
              : status === 'done'
              ? styles.progressStepDone
              : styles.progressStepPending;
            
            return (
              <div
                key={progressStep.id}
                className={`${styles.progressStep} ${stepClass}`}
              >
                {/* Status icon */}
                <div className={styles.progressIcon}>
                  {status === 'done' ? (
                    <div className={styles.progressIconDone}>
                      <svg className={styles.progressIconDoneCheck} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : status === 'active' ? (
                    <div className={styles.progressIconActive} />
                  ) : (
                    <div className={styles.progressIconPending} />
                  )}
                </div>
                
                {/* Label and endpoint */}
                <div className={styles.progressContent}>
                  <p className={`${styles.progressLabel} ${
                    status === 'active' ? styles.progressLabelActive : 
                    status === 'done' ? styles.progressLabelDone : styles.progressLabelPending
                  }`}>
                    {progressStep.label}
                  </p>
                  {progressStep.endpoint && (
                    <p className={`${styles.progressEndpoint} ${
                      status === 'active' ? styles.progressEndpointActive : styles.progressEndpointInactive
                    }`}>
                      → {progressStep.endpoint}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className={styles.progressFooter}>
          No data is sent to our servers
        </p>
      </div>
    );
  }

  // Input form
  return (
    <div className={styles.card}>
      <h2 className={styles.heading}>
        Lock Your Secret
      </h2>

      <div className={styles.form}>
        {/* Vault name */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>
            Vault name <span className={styles.optionalText}>(optional)</span>
          </label>
          <input
            type="text"
            value={vaultName}
            onChange={(e) => setVaultName(e.target.value)}
            placeholder="e.g., Birthday message for Mom"
            maxLength={100}
            className={styles.input}
          />
        </div>

        {/* Text input */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>
            Secret message
          </label>
          <textarea
            value={secretText}
            onChange={(e) => setSecretText(e.target.value)}
            placeholder="Enter your secret..."
            rows={4}
            className={`${styles.input} ${styles.textarea} ${tooLarge ? styles.inputError : ''}`}
          />
          {hasContent && (
            <p className={`${styles.hint} ${tooLarge ? styles.hintError : ''}`}>
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
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={destroyAfterRead}
            onChange={(e) => setDestroyAfterRead(e.target.checked)}
            className={styles.checkbox}
          />
          <div>
            <span className={styles.checkboxText}>Destroy after reading</span>
            <p className={styles.checkboxHint}>Vault will be deleted after first unlock</p>
          </div>
        </label>

        {/* Error */}
        {error && <p className={styles.error}>{error}</p>}

        {/* Submit */}
        <button
          onClick={handleCreate}
          disabled={!canCreate || tooLarge}
          className="btn-primary"
          style={{ width: '100%' }}
        >
          Lock Secret
        </button>
      </div>
    </div>
  );
}
