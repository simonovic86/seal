'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CreateVaultForm } from '@/components/CreateVaultForm';
import { useToast } from '@/components/Toast';
import { getAllVaultRefs, VaultRef } from '@/lib/storage';
import { isUnlockable } from '@/lib/lit';
import { encodeBackupUrl } from '@/lib/share';
import styles from './page.module.css';

export default function Home() {
  const [vaults, setVaults] = useState<VaultRef[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    getAllVaultRefs().then((v) => {
      setVaults(v);
      setLoading(false);
    });
  }, []);

  const handleVaultCreated = (vault: VaultRef) => {
    setVaults((prev) => [vault, ...prev]);
  };

  const handleBackup = async () => {
    const backupUrl = encodeBackupUrl(vaults);
    await navigator.clipboard.writeText(backupUrl);
    showToast('Backup link copied!');
  };

  return (
    <>
    {ToastComponent}
    <main className={styles.main}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <svg
            className={styles.logoIcon}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className={styles.title}>
          Time-Locked Vault
        </h1>
        <p className={styles.subtitle}>
          Encrypt secrets with time-based access control.
        </p>
      </header>

      {/* Create vault form */}
      <CreateVaultForm onVaultCreated={handleVaultCreated} />

      {/* Saved vaults */}
      {!loading && vaults.length > 0 && (
        <section className={styles.vaultsSection}>
          <div className={styles.vaultsHeader}>
            <h2 className={styles.vaultsTitle}>
              Your Vaults
            </h2>
              <button
              onClick={handleBackup}
              className={styles.backupButton}
            >
              <svg className={styles.backupIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Backup
            </button>
          </div>
          <div className={styles.vaultsList}>
            {vaults.map((vault) => {
              const unlockable = isUnlockable(vault.unlockTime);
              return (
                <Link
                  key={vault.id}
                  href={`/vault/${vault.id}`}
                  className={styles.vaultLink}
                >
                  <div className={styles.vaultContent}>
                    <div className={styles.vaultLeft}>
                      <div
                        className={`${styles.vaultIconContainer} ${
                          unlockable 
                            ? styles.vaultIconContainerUnlockable 
                            : styles.vaultIconContainerLocked
                        }`}
                      >
                        <svg
                          className={`${styles.vaultIcon} ${unlockable ? styles.vaultIconUnlockable : styles.vaultIconLocked}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          {unlockable ? (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                            />
                          ) : (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          )}
                        </svg>
                      </div>
                      <div className={styles.vaultInfo}>
                        <p className={styles.vaultName}>
                          {vault.name || `Vault ${vault.id.slice(0, 8)}`}
                        </p>
                        <p className={styles.vaultStatus}>
                          {unlockable
                            ? 'Ready to unlock'
                            : `Unlocks ${new Date(vault.unlockTime).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <svg
                      className={styles.chevronIcon}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.footerText}>
          No accounts. No servers. Encrypted in your browser.
        </p>
        <p className={styles.footerSubtext}>
          We keep nothing. Verify everything.
        </p>
        
        {/* Technology badges */}
        <div className={styles.techBadges}>
          <a
            href="https://litprotocol.com"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.litBadge}
          >
            <svg className={styles.litIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Lit Protocol
          </a>
        </div>
      </footer>
    </main>
    </>
  );
}
