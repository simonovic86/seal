/**
 * Restore page - Restore vaults from backup
 */

import './styles/globals.css';
import './styles/shared.css';
import { decodeBackupFromHash } from './lib/share';
import { saveVaultRef, getAllVaultRefs, VaultRef } from './lib/storage';
import styles from './styles/restore-page.module.css';

type State = 'loading' | 'preview' | 'restoring' | 'done' | 'error';

class RestorePage {
  private state: State = 'loading';
  private vaultsToRestore: VaultRef[] = [];
  private existingCount = 0;
  private newCount = 0;
  private error: string | null = null;

  async init(): Promise<void> {
    const app = document.getElementById('app');
    if (!app) {
      return;
    }

    await this.loadBackup();
    this.render();
  }

  private async loadBackup(): Promise<void> {
    try {
      const hash = window.location.hash;
      const backupVaults = decodeBackupFromHash(hash);

      if (!backupVaults || backupVaults.length === 0) {
        this.error = 'Invalid or empty backup link.';
        this.state = 'error';
        return;
      }

      // Check which vaults already exist
      const existingVaults = await getAllVaultRefs();
      const existingIds = new Set(existingVaults.map((v) => v.id));

      const newVaults = backupVaults.filter((v) => !existingIds.has(v.id));
      const existingInBackup = backupVaults.length - newVaults.length;

      this.vaultsToRestore = backupVaults;
      this.newCount = newVaults.length;
      this.existingCount = existingInBackup;
      this.state = 'preview';
    } catch (err) {
      console.error('Backup load error:', err);
      this.error = 'Failed to load backup';
      this.state = 'error';
    }
  }

  private render(): void {
    const app = document.getElementById('app');
    if (!app) {
      return;
    }

    app.innerHTML = '';

    const main = document.createElement('main');

    switch (this.state) {
      case 'loading':
        this.renderLoading(main);
        break;
      case 'error':
        this.renderError(main);
        break;
      case 'preview':
        this.renderPreview(main);
        break;
      case 'restoring':
        this.renderRestoring(main);
        break;
      case 'done':
        this.renderDone(main);
        break;
    }

    app.appendChild(main);
  }

  private renderLoading(main: HTMLElement): void {
    main.className = styles.mainCentered;
    const spinner = document.createElement('div');
    spinner.className = styles.spinner;
    main.appendChild(spinner);
  }

  private renderError(main: HTMLElement): void {
    main.className = `${styles.mainCentered} ${styles.main}`;
    const card = document.createElement('div');
    card.className = `${styles.card} ${styles.cardCenter}`;
    card.innerHTML = `
      <p class="${styles.message}">${this.error ?? 'Restore failed'}</p>
      <a href="./" class="btn-secondary" style="display: inline-flex; padding: 0.75rem 1.5rem; text-decoration: none;">Back</a>
    `;
    main.appendChild(card);
  }

  private renderPreview(main: HTMLElement): void {
    main.className = styles.main;
    const card = document.createElement('div');
    card.className = styles.card;

    const stats = document.createElement('div');
    stats.className = styles.stats;

    // New vaults
    if (this.newCount > 0) {
      const newCard = document.createElement('div');
      newCard.className = `${styles.statCard} ${styles.statCardHighlight}`;
      newCard.innerHTML = `
        <div class="${styles.statRow}">
          <span class="${styles.statLabel} ${styles.statLabelHighlight}">${this.newCount} new</span>
        </div>
      `;
      stats.appendChild(newCard);
    }

    // Existing vaults
    if (this.existingCount > 0) {
      const existingCard = document.createElement('div');
      existingCard.className = styles.statCard;
      existingCard.innerHTML = `
        <div class="${styles.statRow}">
          <span class="${styles.statLabel} ${styles.statLabelMuted}">${this.existingCount} already exist</span>
        </div>
      `;
      stats.appendChild(existingCard);
    }

    card.appendChild(stats);

    // Action button
    if (this.newCount > 0) {
      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'btn-primary';
      restoreBtn.style.width = '100%';
      restoreBtn.textContent = `Restore`;
      restoreBtn.addEventListener('click', () => {
      void this.handleRestore();
    });
      card.appendChild(restoreBtn);
    } else {
      const noVaults = document.createElement('div');
      noVaults.className = styles.noVaultsMessage;
      noVaults.innerHTML = `
        <p class="${styles.noVaultsText}">All vaults already exist.</p>
        <a href="./" class="btn-secondary" style="display: inline-flex; padding: 0.75rem 1.5rem; text-decoration: none;">Back</a>
      `;
      card.appendChild(noVaults);
    }

    main.appendChild(card);
  }

  private renderRestoring(main: HTMLElement): void {
    main.className = `${styles.mainCentered} ${styles.main}`;
    const card = document.createElement('div');
    card.className = `${styles.card} ${styles.cardCenter}`;
    card.innerHTML = `
      <div class="${styles.spinner} ${styles.spinnerLarge}"></div>
    `;
    main.appendChild(card);
  }

  private renderDone(main: HTMLElement): void {
    main.className = `${styles.mainCentered} ${styles.main}`;
    const card = document.createElement('div');
    card.className = `${styles.card} ${styles.cardCenter}`;
    card.innerHTML = `
      <div class="${styles.iconContainerLg}">
        <svg class="${styles.iconLg}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p class="${styles.message}">${this.newCount} restored</p>
    `;

    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn-primary';
    viewBtn.style.width = '100%';
    viewBtn.textContent = 'Done';
    viewBtn.addEventListener('click', () => {
      window.location.href = './';
    });
    card.appendChild(viewBtn);

    main.appendChild(card);
  }

  private async handleRestore(): Promise<void> {
    this.state = 'restoring';
    this.render();

    try {
      // Get existing vault IDs
      const existingVaults = await getAllVaultRefs();
      const existingIds = new Set(existingVaults.map((v) => v.id));

      // Only save new vaults
      for (const vault of this.vaultsToRestore) {
        if (!existingIds.has(vault.id)) {
          await saveVaultRef(vault);
        }
      }

      this.state = 'done';
      this.render();
    } catch (err) {
      console.error('Restore error:', err);
      this.error = 'Failed to restore vaults. Please try again.';
      this.state = 'error';
      this.render();
    }
  }
}

// Initialize page
const restorePage = new RestorePage();
void restorePage.init();
