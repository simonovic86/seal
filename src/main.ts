/**
 * Home page - Create vaults and view vault list
 */

import './polyfills';
import './styles/globals.css';
import './styles/shared.css';
import { CreateVaultForm } from './components-vanilla/CreateVaultForm';
import { getAllVaultRefs, VaultRef } from './lib/storage';
import { isUnlockable } from './lib/lit';
import { encodeBackupUrl } from './lib/share';
import { eventBus } from './lib/component';
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

    const logoContainer = document.createElement('div');
    logoContainer.className = styles.logoContainer;

    const logoSvg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    );
    logoSvg.setAttribute('class', styles.logoIcon);
    logoSvg.setAttribute('fill', 'none');
    logoSvg.setAttribute('stroke', 'currentColor');
    logoSvg.setAttribute('viewBox', '0 0 24 24');
    const logoPath = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    logoPath.setAttribute('stroke-linecap', 'round');
    logoPath.setAttribute('stroke-linejoin', 'round');
    logoPath.setAttribute('stroke-width', '1.5');
    logoPath.setAttribute(
      'd',
      'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    );
    logoSvg.appendChild(logoPath);
    logoContainer.appendChild(logoSvg);

    const title = document.createElement('h1');
    title.className = styles.title;
    title.textContent = 'Time-Locked Vault';

    const subtitle = document.createElement('p');
    subtitle.className = styles.subtitle;
    subtitle.textContent = 'Encrypt secrets with time-based access control.';

    header.appendChild(logoContainer);
    header.appendChild(title);
    header.appendChild(subtitle);

    return header;
  }

  private createFooter(): HTMLElement {
    const footer = document.createElement('footer');
    footer.className = styles.footer;

    const text1 = document.createElement('p');
    text1.className = styles.footerText;
    text1.textContent = 'No accounts. No servers. Encrypted in your browser.';

    const text2 = document.createElement('p');
    text2.className = styles.footerSubtext;
    text2.textContent = 'We keep nothing. Verify everything.';

    const badges = document.createElement('div');
    badges.className = styles.techBadges;

    const litBadge = document.createElement('a');
    litBadge.href = 'https://litprotocol.com';
    litBadge.target = '_blank';
    litBadge.rel = 'noopener noreferrer';
    litBadge.className = styles.litBadge;
    litBadge.innerHTML = `
      <svg class="${styles.litIcon}" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Lit Protocol
    `;
    badges.appendChild(litBadge);

    footer.appendChild(text1);
    footer.appendChild(text2);
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
    title.textContent = 'Your Vaults';

    const backupBtn = document.createElement('button');
    backupBtn.className = styles.backupButton;
    backupBtn.innerHTML = `
      <svg class="${styles.backupIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      </svg>
      Backup
    `;
    backupBtn.addEventListener('click', () => this.handleBackup());

    header.appendChild(title);
    header.appendChild(backupBtn);
    section.appendChild(header);

    // Vault list
    const list = document.createElement('div');
    list.className = styles.vaultsList;

    this.vaults.forEach((vault) => {
      const unlockable = isUnlockable(vault.unlockTime);
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
              <p class="${styles.vaultName}">${vault.name || (vault.id ? `Vault ${vault.id.slice(0, 8)}` : 'Vault')}</p>
              <p class="${styles.vaultStatus}">${unlockable ? 'Ready to unlock' : `Unlocks ${new Date(vault.unlockTime).toLocaleDateString()}`}</p>
            </div>
          </div>
          <svg class="${styles.chevronIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      `;

      list.appendChild(link);
    });

    section.appendChild(list);
  }

  private async handleBackup(): Promise<void> {
    const backupUrl = encodeBackupUrl(this.vaults);
    await navigator.clipboard.writeText(backupUrl);
    eventBus.emit('toast:show', 'Backup link copied!');
  }
}

// Initialize page
const homePage = new HomePage();
homePage.init();

