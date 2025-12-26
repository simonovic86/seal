'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { decodeBackupFromHash } from '@/lib/share';
import { saveVaultRef, getAllVaultRefs, VaultRef } from '@/lib/storage';
import styles from './page.module.css';
import '@/styles/shared.css';

type State = 'loading' | 'preview' | 'restoring' | 'done' | 'error';

export default function RestorePage() {
  const router = useRouter();
  const [state, setState] = useState<State>('loading');
  const [vaultsToRestore, setVaultsToRestore] = useState<VaultRef[]>([]);
  const [existingCount, setExistingCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBackup = async () => {
      const hash = window.location.hash;
      const backupVaults = decodeBackupFromHash(hash);

      if (!backupVaults || backupVaults.length === 0) {
        setError('Invalid or empty backup link.');
        setState('error');
        return;
      }

      // Check which vaults already exist
      const existingVaults = await getAllVaultRefs();
      const existingIds = new Set(existingVaults.map((v) => v.id));

      const newVaults = backupVaults.filter((v) => !existingIds.has(v.id));
      const existingInBackup = backupVaults.length - newVaults.length;

      setVaultsToRestore(backupVaults);
      setNewCount(newVaults.length);
      setExistingCount(existingInBackup);
      setState('preview');
    };

    loadBackup();
  }, []);

  const handleRestore = async () => {
    setState('restoring');

    try {
      // Get existing vault IDs
      const existingVaults = await getAllVaultRefs();
      const existingIds = new Set(existingVaults.map((v) => v.id));

      // Only save new vaults
      for (const vault of vaultsToRestore) {
        if (!existingIds.has(vault.id)) {
          await saveVaultRef(vault);
        }
      }

      setState('done');
    } catch (err) {
      console.error('Restore error:', err);
      setError('Failed to restore vaults. Please try again.');
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

  // Error
  if (state === 'error') {
    return (
      <main className={`${styles.mainCentered} ${styles.main}`}>
        <div className={`${styles.card} ${styles.cardCenter}`}>
          <div className={styles.iconContainerLg}>
            <svg className={styles.iconLg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className={styles.title}>Restore Failed</h1>
          <p className={styles.message}>{error}</p>
          <Link
            href="/"
            className="btn-secondary"
            style={{ display: 'inline-flex', padding: '0.75rem 1.5rem' }}
          >
            Go Home
          </Link>
        </div>
      </main>
    );
  }

  // Preview
  if (state === 'preview') {
    return (
      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.iconContainerMd}>
              <svg className={styles.iconMd} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div className={styles.headerInfo}>
              <h1 className={styles.title}>Restore Vaults</h1>
              <p className={styles.subtitle}>From backup link</p>
            </div>
          </div>

          <div className={styles.stats}>
            <div className={styles.statCard}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Total in backup</span>
                <span className={styles.statValue}>{vaultsToRestore.length}</span>
              </div>
            </div>

            {newCount > 0 && (
              <div className={`${styles.statCard} ${styles.statCardHighlight}`}>
                <div className={styles.statRow}>
                  <span className={`${styles.statLabel} ${styles.statLabelHighlight}`}>New vaults to add</span>
                  <span className={styles.statValue}>{newCount}</span>
                </div>
              </div>
            )}

            {existingCount > 0 && (
              <div className={styles.statCard}>
                <div className={styles.statRow}>
                  <span className={`${styles.statLabel} ${styles.statLabelMuted}`}>Already exist (skipped)</span>
                  <span className={`${styles.statValue} ${styles.statValueMuted}`}>{existingCount}</span>
                </div>
              </div>
            )}
          </div>

          {newCount > 0 ? (
            <button
              onClick={handleRestore}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              Restore {newCount} Vault{newCount !== 1 ? 's' : ''}
            </button>
          ) : (
            <div className={styles.noVaultsMessage}>
              <p className={styles.noVaultsText}>All vaults already exist on this device.</p>
              <Link
                href="/"
                className="btn-secondary"
                style={{ display: 'inline-flex', padding: '0.75rem 1.5rem' }}
              >
                Go to Vaults
              </Link>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Restoring
  if (state === 'restoring') {
    return (
      <main className={`${styles.mainCentered} ${styles.main}`}>
        <div className={`${styles.card} ${styles.cardCenter}`}>
          <div className={`${styles.spinner} ${styles.spinnerLarge}`} />
          <h2 className={styles.title}>Restoring Vaults</h2>
          <p className={styles.progressText}>Please wait...</p>
        </div>
      </main>
    );
  }

  // Done
  return (
    <main className={`${styles.mainCentered} ${styles.main}`}>
      <div className={`${styles.card} ${styles.cardCenter}`}>
        <div className={styles.iconContainerLg}>
          <svg className={`${styles.iconLg} ${styles.iconMd}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className={styles.title}>Restore Complete!</h1>
        <p className={styles.message}>
          {newCount} vault{newCount !== 1 ? 's' : ''} restored successfully.
        </p>
        <button
          onClick={() => router.push('/')}
          className="btn-primary"
          style={{ width: '100%' }}
        >
          View Your Vaults
        </button>
      </div>
    </main>
  );
}
