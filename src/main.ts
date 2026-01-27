/**
 * Home page - Create vaults and view vault list
 */

import './styles/globals.css';
import './styles/shared.css';
import './components-vanilla/Toast'; // Side-effect: registers toast event listener
import { CreateVaultForm } from './components-vanilla/CreateVaultForm';
import { confirm } from './components-vanilla/ConfirmModal';
import {
  getAllVaultRefs,
  getAllVaultIds,
  saveVaultRef,
  forgetVault,
  VaultRef,
} from './lib/storage';
import { isUnlockable } from './lib/tlock';
import { eventBus } from './lib/component';
import { resolveVaultNameForCreatedAt } from './lib/vaultName';
import {
  downloadVaultExport,
  downloadBackupBundle,
  parseVEFFile,
  createRestorePreview,
  restoreVaultFromVEF,
  restoreFromBundle,
} from './lib/vef';
import styles from './styles/page.module.css';

class HomePage {
  private vaults: VaultRef[] = [];
  private loading = true;

  async init() {
    const app = document.getElementById('app');
    if (!app) return;

    // Render page structure
    app.innerHTML = '';

    // Header
    const header = this.createHeader();
    app.appendChild(header);

    // Create vault form
    const createForm = new CreateVaultForm((vault) => {
      this.vaults.unshift(vault);
      this.renderVaultList();
    });
    createForm.mount(app);

    // Vaults section
    const vaultsSection = document.createElement('section');
    vaultsSection.className = styles.vaultsSection;
    vaultsSection.id = 'vaults-section';
    vaultsSection.style.display = 'none';
    app.appendChild(vaultsSection);

    // Footer
    const footer = this.createFooter();
    app.appendChild(footer);

    // Load vaults
    await this.loadVaults();
  }

  private createHeader(): HTMLElement {
    const header = document.createElement('header');
    header.className = styles.header;

    const title = document.createElement('h1');
    title.className = styles.title;
    title.textContent = 'Seal';

    header.appendChild(title);

    return header;
  }

  private createFooter(): HTMLElement {
    const footer = document.createElement('footer');
    footer.className = styles.footer;

    const badges = document.createElement('div');
    badges.className = styles.techBadges;

    const drandBadge = document.createElement('a');
    drandBadge.href = 'https://drand.love';
    drandBadge.target = '_blank';
    drandBadge.rel = 'noopener noreferrer';
    drandBadge.className = styles.techBadge;
    drandBadge.innerHTML = `
      <svg class="${styles.techIcon}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
      drand
    `;
    badges.appendChild(drandBadge);

    footer.appendChild(badges);

    return footer;
  }

  private async loadVaults(): Promise<void> {
    try {
      this.vaults = await getAllVaultRefs();
      this.loading = false;
      this.renderVaultList();
    } catch (err) {
      console.error('Failed to load vaults:', err);
      this.loading = false;
    }
  }

  private renderVaultList(): void {
    const section = document.getElementById('vaults-section');
    if (!section || this.loading || this.vaults.length === 0) {
      if (section) section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    section.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = styles.vaultsHeader;

    const title = document.createElement('h2');
    title.className = styles.vaultsTitle;
    title.textContent = 'Vaults';

    const buttonGroup = document.createElement('div');
    buttonGroup.className = styles.buttonGroup;

    const importBtn = document.createElement('button');
    importBtn.className = styles.importButton;
    importBtn.innerHTML = `
      <svg class="${styles.backupIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
      Import
    `;
    importBtn.addEventListener('click', () => this.handleImportVault());

    const backupBtn = document.createElement('button');
    backupBtn.className = styles.backupButton;
    backupBtn.innerHTML = `
      <svg class="${styles.backupIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      </svg>
      Backup
    `;
    backupBtn.addEventListener('click', () => this.handleBackup());

    buttonGroup.appendChild(importBtn);
    buttonGroup.appendChild(backupBtn);
    header.appendChild(title);
    header.appendChild(buttonGroup);
    section.appendChild(header);

    // Vault list
    const list = document.createElement('div');
    list.className = styles.vaultsList;

    this.vaults.forEach((vault) => {
      const unlockable = isUnlockable(vault.unlockTime);

      const item = document.createElement('div');
      item.className = styles.vaultItem;

      const link = document.createElement('a');
      const hashData = window.location.hash.slice(1) || '';
      link.href = `./vault.html?id=${vault.id}${hashData ? '#' + hashData : ''}`;
      link.className = styles.vaultLink;

      link.innerHTML = `
        <div class="${styles.vaultContent}">
          <div class="${styles.vaultLeft}">
            <div class="${unlockable ? styles.vaultIconContainerUnlockable : styles.vaultIconContainerLocked}">
              <svg class="${styles.vaultIcon} ${unlockable ? styles.vaultIconUnlockable : styles.vaultIconLocked}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${unlockable ? 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z' : 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'}" />
              </svg>
            </div>
            <div class="${styles.vaultInfo}">
              <p class="${styles.vaultName}">${resolveVaultNameForCreatedAt(vault.name, vault.createdAt)}</p>
              <p class="${styles.vaultStatus}">${unlockable ? 'Ready to unlock' : `Unlocks ${new Date(vault.unlockTime).toLocaleDateString()}`}</p>
            </div>
          </div>
          <svg class="${styles.chevronIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      `;

      const exportBtn = document.createElement('button');
      exportBtn.className = styles.exportButton;
      exportBtn.title = 'Export vault';
      exportBtn.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      `;
      exportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleExportVault(vault);
      });

      const forgetBtn = document.createElement('button');
      forgetBtn.className = styles.forgetButton;
      forgetBtn.title = 'Forget vault';
      forgetBtn.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      `;
      forgetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleForgetVault(vault);
      });

      item.appendChild(link);
      item.appendChild(exportBtn);
      item.appendChild(forgetBtn);
      list.appendChild(item);
    });

    section.appendChild(list);
  }

  private async handleBackup(): Promise<void> {
    try {
      const count = await downloadBackupBundle(this.vaults);
      eventBus.emit('toast:show', `Backed up ${count} vault${count !== 1 ? 's' : ''}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Backup failed';
      console.error('Backup failed:', err);
      eventBus.emit('toast:show', message);
    }
  }

  private async handleExportVault(vault: VaultRef): Promise<void> {
    try {
      await downloadVaultExport(vault);
      eventBus.emit('toast:show', 'Vault exported!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      console.error('Export failed:', err);
      eventBus.emit('toast:show', message);
    }
  }

  private async handleForgetVault(vault: VaultRef): Promise<void> {
    const confirmed = await confirm(
      'Forget Vault',
      'This removes this vault from this browser only. The URL will still work.',
      'Forget',
      'Cancel',
    );
    if (!confirmed) return;

    try {
      await forgetVault(vault.id);
      this.vaults = this.vaults.filter((v) => v.id !== vault.id);
      this.renderVaultList();
    } catch (err) {
      console.error('Forget vault failed:', err);
      eventBus.emit('toast:show', 'Failed to forget vault');
    }
  }

  private async handleImportVault(): Promise<void> {
    // Check if user has existing vaults
    if (this.vaults.length > 0) {
      const confirmed = await confirm(
        'Import Vaults',
        `You have ${this.vaults.length} existing vault${this.vaults.length !== 1 ? 's' : ''}. Duplicates will be skipped.`,
        'Continue',
        'Cancel',
      );
      if (!confirmed) return;
    }

    // Create hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.vef.json';
    input.multiple = false;

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      // Parse file (handles both single VEF and backup bundle)
      const parsed = await parseVEFFile(file);

      if (parsed.type === 'error') {
        eventBus.emit('toast:show', `Invalid file: ${parsed.error}`);
        return;
      }

      // Get existing vault IDs
      const existingIds = await getAllVaultIds();

      if (parsed.type === 'bundle') {
        // Handle backup bundle (multiple vaults)
        const result = await restoreFromBundle(parsed.bundle, existingIds, saveVaultRef);

        if (result.restored > 0) {
          await this.loadVaults();
        }

        if (result.errors.length > 0) {
          console.error('Restore errors:', result.errors);
        }

        const parts: string[] = [];
        if (result.restored > 0) {
          parts.push(`${result.restored} restored`);
        }
        if (result.skipped > 0) {
          parts.push(`${result.skipped} skipped`);
        }
        if (result.errors.length > 0) {
          parts.push(`${result.errors.length} failed`);
        }

        eventBus.emit('toast:show', parts.join(', ') || 'No vaults to restore');
      } else {
        // Handle single VEF
        const preview = await createRestorePreview(parsed.vef, existingIds);

        if (preview.already_exists) {
          eventBus.emit('toast:show', 'Vault already exists');
          return;
        }

        const restoreResult = await restoreVaultFromVEF(parsed.vef, existingIds, saveVaultRef);

        if (restoreResult.success && !restoreResult.skipped) {
          await this.loadVaults();
          eventBus.emit('toast:show', 'Vault restored!');
        } else if (restoreResult.skipped) {
          eventBus.emit('toast:show', 'Vault already exists');
        } else {
          eventBus.emit('toast:show', `Restore failed: ${restoreResult.error}`);
        }
      }
    };

    input.click();
  }
}

// Initialize page
const homePage = new HomePage();
homePage.init();
