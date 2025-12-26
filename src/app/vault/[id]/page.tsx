'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { VaultCountdown } from '@/components/VaultCountdown';
import { getVaultRef, deleteVaultRef, VaultRef } from '@/lib/storage';
import { fromBase64 } from '@/lib/encoding';
import { initLit, decryptKey, isUnlockable } from '@/lib/lit';
import { importKey, decryptToString } from '@/lib/crypto';
import { decodeVaultFromHash } from '@/lib/share';
import { useToast } from '@/components/Toast';
import { QRCodeModal } from '@/components/QRCode';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getFriendlyError } from '@/lib/errors';
import { getShareableUrl } from '@/lib/share';
import styles from './page.module.css';
import '@/styles/shared.css';

type State = 'loading' | 'not_found' | 'locked' | 'ready' | 'unlocking' | 'unlocked' | 'destroyed' | 'error';

export default function VaultPage() {
  const params = useParams();
  const id = params.id as string;
  const [state, setState] = useState<State>('loading');
  const [vault, setVault] = useState<VaultRef | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [decryptedSecret, setDecryptedSecret] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);
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
        setState(isUnlockable(sharedVault.unlockTime) ? 'ready' : 'locked');
        return;
      }

      // Not found anywhere
      setState('not_found');
    };

    loadVault();
  }, [id]);

  // Security: Clear decrypted secret from memory on unmount
  useEffect(() => {
    return () => {
      setDecryptedSecret(null);
    };
  }, []);

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

      // Load encrypted data from URL
      setProgress('Loading encrypted data...');
      const encryptedData = fromBase64(vault.inlineData);

      // Import key and decrypt
      setProgress('Decrypting...');
      const symmetricKey = await importKey(rawKey);
      const secret = await decryptToString(encryptedData, symmetricKey);

      setDecryptedSecret(secret);

      // Handle destroy after read
      if (vault.destroyAfterRead) {
        setProgress('Destroying vault...');
        
        // Delete from local storage (data in URL becomes inaccessible without the key)
        await deleteVaultRef(vault.id);
        
        setState('destroyed');
      } else {
        setState('unlocked');
      }
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
      <main className={styles.mainCentered}>
        <div className={styles.spinner} />
      </main>
    );
  }

  // Not found
  if (state === 'not_found') {
    return (
      <main className={`${styles.mainCentered} ${styles.main}`}>
        <div className={`${styles.card} ${styles.cardCenter}`}>
          <div className={styles.iconContainerLg}>
            <svg className={`${styles.iconLg} ${styles.iconGray}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className={styles.title}>Vault Not Found</h1>
          <p className={styles.message}>
            This vault doesn&apos;t exist. Make sure you have the complete shareable link.
          </p>
          <Link href="/" className="btn-primary" style={{ display: 'inline-flex', padding: '0.75rem 1.5rem' }}>
            Create a Vault
          </Link>
        </div>
      </main>
    );
  }

  // Error
  if (state === 'error') {
    return (
      <main className={styles.main}>
        <div className={styles.backButtonContainer}>
          <Link href="/" className={styles.backButton}>
            <svg className={styles.backIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>
        <div className={`${styles.card} ${styles.cardCenter}`}>
          <div className={styles.iconContainerLg}>
            <svg className={`${styles.iconLg} ${styles.iconNeutral}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className={styles.title}>Unlock Failed</h1>
          <p className={`${styles.message} ${styles.messageMuted}`}>{error}</p>
          <button
            onClick={() => setState('ready')}
            className="btn-secondary"
            style={{ padding: '0.75rem 1.5rem' }}
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
      <main className={styles.main}>
        <div className={styles.backButtonContainer}>
          <Link href="/" className={styles.backButton}>
            <svg className={styles.backIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>
        <div className={styles.card}>
          <h2 className={`${styles.title} ${styles.cardCenter}`}>
            Time-Locked Vault
          </h2>
          {vault.destroyAfterRead && (
            <p className={`${styles.destroyNotice} ${styles.cardCenter}`}>
              This vault will be destroyed after reading
            </p>
          )}
          <VaultCountdown
            unlockTime={vault.unlockTime}
            onUnlockReady={() => setState('ready')}
          />
          
          {/* No early access notice */}
          <div className={styles.cardInner}>
            <p className={styles.noticeText}>
              No early access. No payment option. No support ticket.
              <br />
              <span className={styles.noticeEmphasis}>Even we can&apos;t unlock it.</span>
            </p>
          </div>
          
          <div className={styles.shareButtonContainer}>
            <button
              onClick={() => setShowQR(true)}
              className={styles.shareButton}
            >
              <svg className={styles.shareIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Share QR
            </button>
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
    const handleUnlockClick = () => {
      if (vault.destroyAfterRead) {
        setShowDestroyConfirm(true);
      } else {
        handleUnlock();
      }
    };

    return (
      <>
      <main className={styles.main}>
        <div className={styles.backButtonContainer}>
          <Link href="/" className={styles.backButton}>
            <svg className={styles.backIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>
        <div className={`${styles.card} ${styles.cardCenter}`}>
          <div className={styles.iconContainerLg}>
            <svg className={`${styles.iconLg} ${styles.iconLight}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className={styles.title}>Ready to Unlock</h2>
          <p className={styles.message}>
            This vault can now be opened. Click below to decrypt.
            {vault.destroyAfterRead && (
              <span className={`${styles.destroyNotice} ${styles.destroyNoticeSubtle}`}>
                This vault will be destroyed after reading
              </span>
            )}
          </p>
          <button
            onClick={handleUnlockClick}
            className="btn-primary"
            style={{ width: '100%' }}
          >
            Unlock Vault
          </button>
          <button
            onClick={() => setShowQR(true)}
            className="btn-ghost"
            style={{ width: '100%', marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}
          >
            <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Share via QR
          </button>
        </div>
        <QRCodeModal
          url={getShareableUrl(vault)}
          isOpen={showQR}
          onClose={() => setShowQR(false)}
        />
      </main>
      <ConfirmModal
        isOpen={showDestroyConfirm}
        title="Destroy After Reading"
        message="This vault will be permanently destroyed after you view its contents. This action cannot be undone. Are you sure you want to continue?"
        confirmText="Unlock & Destroy"
        cancelText="Cancel"
        variant="warning"
        onConfirm={() => {
          setShowDestroyConfirm(false);
          handleUnlock();
        }}
        onCancel={() => setShowDestroyConfirm(false)}
      />
      </>
    );
  }

  // Unlocking
  if (state === 'unlocking') {
    return (
      <main className={styles.main}>
        <div className={`${styles.card} ${styles.cardCenter}`}>
          <div className={`${styles.spinner} ${styles.spinnerLarge}`} />
          <h2 className={styles.title}>Unlocking Vault</h2>
          <p className={styles.progressText}>{progress}</p>
        </div>
      </main>
    );
  }

  // Destroyed (burn after reading)
  if (state === 'destroyed') {
    return (
      <>
      {ToastComponent}
      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.destroyHeader}>
            <div className={styles.iconContainerSm}>
              <svg className={styles.iconSm} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
            </div>
            <div className={styles.destroyInfo}>
              <h2 className={styles.destroyTitle}>Vault Destroyed</h2>
              <p className={styles.destroySubtitle}>This secret cannot be accessed again</p>
            </div>
          </div>
          <div className={styles.secretContainer}>
            <p className={styles.secretText}>{decryptedSecret}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(decryptedSecret || '');
              showToast('Secret copied!');
            }}
            className="btn-primary"
            style={{ width: '100%', marginTop: 'var(--space-6)' }}
          >
            Copy Secret
          </button>
          <p className={styles.warningText}>
            Save this secret now — it&apos;s gone forever after you leave this page.
          </p>
          <Link 
            href="/" 
            className="btn-secondary"
            style={{ display: 'block', marginTop: 'var(--space-4)', textAlign: 'center' }}
          >
            Create New Vault
          </Link>
        </div>
      </main>
      </>
    );
  }

  // Unlocked
  return (
    <>
    {ToastComponent}
    <main className={styles.main}>
      <div className={styles.backButtonContainer}>
        <Link href="/" className={styles.backButton}>
          <svg className={styles.backIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
      </div>
      <div className={styles.card}>
        <div className={styles.destroyHeader}>
          <div className={styles.iconContainerSm}>
            <svg className={`${styles.iconSm} ${styles.iconLight}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className={styles.destroyInfo}>
            <h2 className={styles.destroyTitle}>Vault Unlocked</h2>
            <p className={styles.destroySubtitle}>Decrypted successfully</p>
          </div>
        </div>
        <div className={styles.secretContainer}>
          <p className={styles.secretText}>{decryptedSecret}</p>
        </div>
        <div className={styles.buttonRow}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(decryptedSecret || '');
              showToast('Secret copied!');
            }}
            className={`btn-primary ${styles.buttonFlex}`}
          >
            Copy Secret
          </button>
          <Link href="/" className={`btn-secondary ${styles.buttonFlex}`} style={{ textAlign: 'center' }}>
            Create Vault
          </Link>
        </div>
      </div>
      
      {/* Technology badges */}
      <div className={styles.techBadges}>
        <a
          href="https://litprotocol.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.techBadge}
        >
          <svg className={styles.techIcon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Lit Protocol
        </a>
      </div>
    </main>
    </>
  );
}
