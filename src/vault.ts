/**
 * Vault detail page - View and unlock vaults
 */

import './styles/globals.css';
import './styles/shared.css';
import { VaultCountdown } from './components-vanilla/VaultCountdown';
import { confirm } from './components-vanilla/ConfirmModal';
import { getVaultRef, deleteVaultRef, VaultRef } from './lib/storage';
import { fromBase64 } from './lib/encoding';
import { decryptKey, isUnlockable } from './lib/tlock';
import { importKey, decryptToString } from './lib/crypto';
import { decodeVaultFromHash } from './lib/share';
import { getFriendlyError } from './lib/errors';
import { eventBus } from './lib/component';
import { resolveVaultNameForCreatedAt } from './lib/vaultName';
import styles from './styles/vault-page.module.css';

type State =
  | 'loading'
  | 'not_found'
  | 'locked'
  | 'ready'
  | 'unlocking'
  | 'unlocked'
  | 'destroyed'
  | 'error';

class VaultPage {
  private state: State = 'loading';
  private vault: VaultRef | null = null;
  private error: string | null = null;
  private progress = '';
  private decryptedSecret: string | null = null;
  private countdown: VaultCountdown | null = null;

  async init() {
    const app = document.getElementById('app');
    if (!app) return;

    // Get vault ID from URL
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
      this.state = 'not_found';
      this.render();
      return;
    }

    await this.loadVault(id);
    this.render();
  }

  private async loadVault(id: string): Promise<void> {
    try {
      // First try localStorage
      const localVault = await getVaultRef(id);
      if (localVault) {
        this.vault = localVault;
        this.state = isUnlockable(localVault.unlockTime) ? 'ready' : 'locked';
        return;
      }

      // Then try URL hash (shared link)
      const hash = window.location.hash;
      const sharedVault = decodeVaultFromHash(hash, id);
      if (sharedVault) {
        this.vault = sharedVault;
        this.state = isUnlockable(sharedVault.unlockTime) ? 'ready' : 'locked';
        return;
      }

      // Not found anywhere
      this.state = 'not_found';
    } catch (err) {
      console.error('Failed to load vault:', err);
      this.state = 'error';
      this.error = 'Failed to load vault';
    }
  }

  private render(): void {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = '';

    const main = document.createElement('main');

    switch (this.state) {
      case 'loading':
        this.renderLoading(main);
        break;
      case 'not_found':
        this.renderNotFound(main);
        break;
      case 'error':
        this.renderError(main);
        break;
      case 'locked':
        this.renderLocked(main);
        break;
      case 'ready':
        this.renderReady(main);
        break;
      case 'unlocking':
        this.renderUnlocking(main);
        break;
      case 'unlocked':
      case 'destroyed':
        this.renderUnlocked(main);
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

  private renderNotFound(main: HTMLElement): void {
    main.className = `${styles.mainCentered} ${styles.main}`;
    const card = document.createElement('div');
    card.className = `${styles.card} ${styles.cardCenter}`;
    card.innerHTML = `
      <p class="${styles.message}">Vault not found</p>
      <a href="./" class="btn-secondary" style="display: inline-flex; padding: 0.75rem 1.5rem; text-decoration: none;">Back</a>
    `;
    main.appendChild(card);
  }

  private renderError(main: HTMLElement): void {
    main.className = styles.main;
    this.addBackButton(main);

    const card = document.createElement('div');
    card.className = `${styles.card} ${styles.cardCenter}`;
    card.innerHTML = `
      <p class="${styles.message} ${styles.messageMuted}">${this.error || 'An error occurred'}</p>
    `;

    const tryBtn = document.createElement('button');
    tryBtn.className = 'btn-secondary';
    tryBtn.style.padding = '0.75rem 1.5rem';
    tryBtn.textContent = 'Try Again';
    tryBtn.addEventListener('click', () => {
      this.state = 'ready';
      this.render();
    });
    card.appendChild(tryBtn);

    main.appendChild(card);
  }

  private renderLocked(main: HTMLElement): void {
    if (!this.vault) return;

    main.className = styles.main;
    this.addBackButton(main);

    const card = document.createElement('div');
    card.className = styles.card;

    const title = document.createElement('h2');
    title.className = styles.title;
    title.textContent = resolveVaultNameForCreatedAt(this.vault.name, this.vault.createdAt);
    card.appendChild(title);

    if (this.vault.destroyAfterRead) {
      const notice = document.createElement('p');
      notice.className = `${styles.destroyNotice} ${styles.cardCenter}`;
      notice.textContent = 'Destroyed after reading';
      card.appendChild(notice);
    }

    // Countdown
    const countdownContainer = document.createElement('div');
    this.countdown = new VaultCountdown(this.vault.unlockTime, () => {
      this.state = 'ready';
      this.render();
    });
    this.countdown.mount(countdownContainer);
    card.appendChild(countdownContainer);

    // No early access notice
    const noticeCard = document.createElement('div');
    noticeCard.className = styles.cardInner;
    noticeCard.innerHTML = `
      <p class="${styles.noticeText}">No early access. Even we can't unlock it.</p>
    `;
    card.appendChild(noticeCard);

    main.appendChild(card);
  }

  private renderReady(main: HTMLElement): void {
    if (!this.vault) return;

    main.className = styles.main;
    this.addBackButton(main);

    const card = document.createElement('div');
    card.className = `${styles.card} ${styles.cardCenter}`;

    const iconContainer = document.createElement('div');
    iconContainer.className = styles.iconContainerLg;
    iconContainer.innerHTML = `
      <svg class="${styles.iconLg} ${styles.iconLight}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
      </svg>
    `;
    card.appendChild(iconContainer);

    const title = document.createElement('h2');
    title.className = styles.title;
    title.textContent = resolveVaultNameForCreatedAt(this.vault.name, this.vault.createdAt);
    card.appendChild(title);

    if (this.vault.destroyAfterRead) {
      const notice = document.createElement('p');
      notice.className = styles.destroyNotice;
      notice.textContent = 'Destroyed after reading';
      card.appendChild(notice);
    }

    const unlockBtn = document.createElement('button');
    unlockBtn.className = 'btn-primary';
    unlockBtn.style.width = '100%';
    unlockBtn.textContent = 'Unlock';
    unlockBtn.addEventListener('click', () => this.handleUnlockClick());
    card.appendChild(unlockBtn);

    main.appendChild(card);
  }

  private renderUnlocking(main: HTMLElement): void {
    main.className = styles.main;
    const card = document.createElement('div');
    card.className = `${styles.card} ${styles.cardCenter}`;
    card.innerHTML = `
      <div class="${styles.spinner} ${styles.spinnerLarge}"></div>
      <p class="${styles.progressText}">${this.progress}</p>
    `;
    main.appendChild(card);
  }

  private renderUnlocked(main: HTMLElement): void {
    main.className = styles.main;
    this.addBackButton(main);

    const card = document.createElement('div');
    card.className = styles.card;

    if (this.vault) {
      const title = document.createElement('h2');
      title.className = styles.title;
      title.textContent = resolveVaultNameForCreatedAt(this.vault.name, this.vault.createdAt);
      card.appendChild(title);
    }

    const secretContainer = document.createElement('div');
    secretContainer.className = styles.secretContainer;
    const secretText = document.createElement('p');
    secretText.className = styles.secretText;
    this.renderSecretContent(secretText, this.decryptedSecret || '');
    secretContainer.appendChild(secretText);
    card.appendChild(secretContainer);

    const buttonRow = document.createElement('div');
    buttonRow.className = styles.buttonRow;

    const copyBtn = document.createElement('button');
    copyBtn.className = `btn-primary ${styles.buttonFlex}`;
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(this.decryptedSecret || '');
      eventBus.emit('toast:show', 'Copied');
    });

    const homeLink = document.createElement('a');
    homeLink.href = './';
    homeLink.className = `btn-secondary ${styles.buttonFlex}`;
    homeLink.style.textAlign = 'center';
    homeLink.textContent = 'Back';

    buttonRow.appendChild(copyBtn);
    buttonRow.appendChild(homeLink);
    card.appendChild(buttonRow);

    if (this.state === 'destroyed') {
      const warning = document.createElement('p');
      warning.className = styles.warningText;
      warning.textContent = "Save now — gone after you leave.";
      card.appendChild(warning);
    }

    main.appendChild(card);
  }

  private addBackButton(main: HTMLElement): void {
    const backContainer = document.createElement('div');
    backContainer.className = styles.backButtonContainer;
    const backLink = document.createElement('a');
    backLink.href = './';
    backLink.className = styles.backButton;
    backLink.innerHTML = `
      <svg class="${styles.backIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    `;
    backContainer.appendChild(backLink);
    main.appendChild(backContainer);
  }

  /**
   * Renders decrypted secret content to the DOM.
   *
   * INTENTIONALLY MINIMAL - This renderer is deliberately "dumb":
   * - No JSON parsing or structured data interpretation
   * - No schema detection or content classification
   * - No special handling based on URI scheme (vault://, https://, etc.)
   * - No payload validation or transformation
   *
   * The only "smart" behavior is URI detection for clickability, which:
   * - Treats URIs as opaque strings (scheme://anything)
   * - Does NOT validate, resolve, or follow links automatically
   * - Does NOT interpret or index URI content
   *
   * Payload interpretation, linking, and semantic understanding are
   * explicitly OUT OF SCOPE for this renderer. Any such features belong
   * in a separate layer that consumers can opt into.
   *
   * This keeps the vault display predictable, secure, and future-proof.
   */
  private renderSecretContent(container: HTMLElement, content: string): void {
    // Simple line-by-line processing - no parsing, no structure detection
    const lines = content.split('\n');

    // URI pattern: any valid scheme followed by ://
    // Intentionally permissive - we don't validate or classify schemes
    const uriPattern = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/\S+$/;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Binary choice: URI line becomes a link, everything else is text
      // No special cases, no content sniffing, no conditional behavior
      if (trimmed && uriPattern.test(trimmed)) {
        const link = document.createElement('a');
        link.href = trimmed;
        link.textContent = trimmed;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        container.appendChild(link);
      } else {
        // Preserve original line (including whitespace) as plain text
        container.appendChild(document.createTextNode(line));
      }

      // Line breaks between lines, nothing fancy
      if (index < lines.length - 1) {
        container.appendChild(document.createElement('br'));
      }
    });
  }

  private async handleUnlockClick(): Promise<void> {
    if (!this.vault) return;

    if (this.vault.destroyAfterRead) {
      const confirmed = await confirm(
        'Destroy After Reading',
        'This vault will be permanently destroyed after you view its contents. This action cannot be undone. Are you sure you want to continue?',
        'Unlock & Destroy',
        'Cancel',
      );
      if (!confirmed) return;
    }

    await this.handleUnlock();
  }

  private async handleUnlock(): Promise<void> {
    if (!this.vault) return;

    this.state = 'unlocking';
    this.error = null;
    this.render();

    try {
      // Get decryption key from drand via tlock
      this.progress = 'Fetching randomness from drand...';
      this.render();
      const rawKey = await decryptKey(
        this.vault.tlockCiphertext,
        this.vault.tlockRound,
      );

      // Load encrypted data from URL
      this.progress = 'Loading encrypted data...';
      this.render();
      const encryptedData = fromBase64(this.vault.inlineData);

      // Import key and decrypt
      this.progress = 'Decrypting...';
      this.render();
      const symmetricKey = await importKey(rawKey);
      const secret = await decryptToString(encryptedData, symmetricKey);

      this.decryptedSecret = secret;

      // Handle destroy after read
      if (this.vault.destroyAfterRead) {
        this.progress = 'Destroying vault...';
        this.render();
        await deleteVaultRef(this.vault.id);
        this.state = 'destroyed';
      } else {
        this.state = 'unlocked';
      }

      this.render();
    } catch (err) {
      console.error('Unlock error:', err);
      const friendlyError = getFriendlyError(
        err instanceof Error ? err : new Error(String(err)),
      );
      this.error = friendlyError.message;
      this.state = 'error';
      this.render();
    }
  }
}

// Initialize page
const vaultPage = new VaultPage();
vaultPage.init();
