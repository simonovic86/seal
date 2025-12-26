/**
 * Create vault form component (Vanilla JS)
 */

import { Component, eventBus } from '@/lib/component';
import { TimeSelector } from './TimeSelector';
import { generateKey, exportKey, encrypt } from '@/lib/crypto';
import { initLit, encryptKeyWithTimelock } from '@/lib/lit';
import { toBase64 } from '@/lib/encoding';
import { saveVaultRef, VaultRef } from '@/lib/storage';
import { getShareableUrl } from '@/lib/share';
import { getFriendlyError } from '@/lib/errors';
import styles from '../components/CreateVaultForm.module.css';
import '@/styles/shared.css';

const MAX_VAULT_SIZE = 32 * 1024; // 32KB

type Step = 'input' | 'creating' | 'done';

const PROGRESS_STEPS = [
  { id: 'encrypt', label: 'Encrypting in your browser', endpoint: 'local' },
  { id: 'lit', label: 'Connecting to Lit Protocol', endpoint: 'litprotocol.com' },
  { id: 'store', label: 'Preparing shareable link', endpoint: 'local' },
  { id: 'timelock', label: 'Applying time-lock', endpoint: 'litprotocol.com' },
  { id: 'save', label: 'Saving locally', endpoint: 'local' },
];

interface CreateVaultFormState {
  step: Step;
  vaultName: string;
  secretText: string;
  destroyAfterRead: boolean;
  error: string | null;
  currentProgressStep: string;
  createdVault: VaultRef | null;
}

export class CreateVaultForm extends Component<CreateVaultFormState> {
  private timeSelector: TimeSelector | null = null;
  private onVaultCreated?: (vault: VaultRef) => void;

  constructor(onVaultCreated?: (vault: VaultRef) => void) {
    super({
      step: 'input',
      vaultName: '',
      secretText: '',
      destroyAfterRead: false,
      error: null,
      currentProgressStep: '',
      createdVault: null,
    });
    this.onVaultCreated = onVaultCreated;
  }

  protected render(): HTMLElement {
    const container = this.createElement('div', [styles.card]);
    this.renderCurrentStep(container);
    return container;
  }

  private renderCurrentStep(container: HTMLElement): void {
    container.innerHTML = '';

    switch (this.state.step) {
      case 'input':
        this.renderInputForm(container);
        break;
      case 'creating':
        this.renderCreatingState(container);
        break;
      case 'done':
        this.renderDoneState(container);
        break;
    }
  }

  private renderInputForm(container: HTMLElement): void {
    container.className = styles.card;

    // Heading
    const heading = this.createElement('h2', [styles.heading]);
    heading.textContent = 'Lock Your Secret';
    container.appendChild(heading);

    // Form
    const form = this.createElement('div', [styles.form]);

    // Vault name field
    const nameField = this.createElement('div', [styles.field]);
    const nameLabel = this.createElement('label', [styles.fieldLabel]);
    nameLabel.innerHTML = 'Vault name <span class="' + styles.optionalText + '">(optional)</span>';
    const nameInput = this.createElement('input', [styles.input]) as HTMLInputElement;
    nameInput.type = 'text';
    nameInput.placeholder = 'e.g., Birthday message for Mom';
    nameInput.maxLength = 100;
    nameInput.value = this.state.vaultName;
    nameInput.addEventListener('input', (e) => {
      this.setState({ vaultName: (e.target as HTMLInputElement).value });
    });
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);
    form.appendChild(nameField);

    // Secret message field
    const secretField = this.createElement('div', [styles.field]);
    const secretLabel = this.createElement('label', [styles.fieldLabel]);
    secretLabel.textContent = 'Secret message';
    const secretTextarea = this.createElement('textarea', [
      styles.input,
      styles.textarea,
    ]) as HTMLTextAreaElement;
    secretTextarea.placeholder = 'Enter your secret...';
    secretTextarea.rows = 4;
    secretTextarea.value = this.state.secretText;

    const estimatedSize =
      new TextEncoder().encode(this.state.secretText).length * 1.5;
    const tooLarge = estimatedSize > MAX_VAULT_SIZE;

    if (tooLarge) {
      secretTextarea.classList.add(styles.inputError);
    }

    secretTextarea.addEventListener('input', (e) => {
      this.setState({ secretText: (e.target as HTMLTextAreaElement).value });
    });

    secretField.appendChild(secretLabel);
    secretField.appendChild(secretTextarea);

    // Size hint
    if (this.state.secretText.trim()) {
      const hint = this.createElement('p', [
        styles.hint,
        tooLarge ? styles.hintError : '',
      ]);
      hint.textContent = tooLarge
        ? `Too large! Maximum ${Math.floor(MAX_VAULT_SIZE / 1024)}KB (currently ~${Math.floor(estimatedSize / 1024)}KB)`
        : 'Will be stored in shareable link';
      secretField.appendChild(hint);
    }

    form.appendChild(secretField);

    // Time selector
    if (!this.timeSelector) {
      this.timeSelector = new TimeSelector(() => this.update());
    }
    const timeSelectorContainer = this.createElement('div');
    this.timeSelector.mount(timeSelectorContainer);
    form.appendChild(timeSelectorContainer);

    // Destroy after read checkbox
    const checkboxLabel = this.createElement('label', [styles.checkboxLabel]);
    const checkbox = this.createElement('input', [
      styles.checkbox,
    ]) as HTMLInputElement;
    checkbox.type = 'checkbox';
    checkbox.checked = this.state.destroyAfterRead;
    checkbox.addEventListener('change', (e) => {
      this.setState({
        destroyAfterRead: (e.target as HTMLInputElement).checked,
      });
    });

    const checkboxTextContainer = this.createElement('div');
    const checkboxText = this.createElement('span', [styles.checkboxText]);
    checkboxText.textContent = 'Destroy after reading';
    const checkboxHint = this.createElement('p', [styles.checkboxHint]);
    checkboxHint.textContent = 'Vault will be deleted after first unlock';

    checkboxTextContainer.appendChild(checkboxText);
    checkboxTextContainer.appendChild(checkboxHint);
    checkboxLabel.appendChild(checkbox);
    checkboxLabel.appendChild(checkboxTextContainer);
    form.appendChild(checkboxLabel);

    // Error message
    if (this.state.error) {
      const errorEl = this.createElement('p', [styles.error]);
      errorEl.textContent = this.state.error;
      form.appendChild(errorEl);
    }

    // Submit button
    const hasContent = this.state.secretText.trim();
    const unlockTime = this.timeSelector?.getValue();
    const canCreate = hasContent && unlockTime;

    const submitBtn = this.createElement('button', ['btn-primary']);
    submitBtn.textContent = 'Lock Secret';
    submitBtn.style.width = '100%';
    (submitBtn as HTMLButtonElement).disabled = !canCreate || tooLarge;
    submitBtn.addEventListener('click', () => this.handleCreate());
    form.appendChild(submitBtn);

    container.appendChild(form);
  }

  private renderCreatingState(container: HTMLElement): void {
    container.className = styles.card;

    const title = this.createElement('h2', [styles.progressTitle]);
    title.textContent = 'Creating Vault';
    container.appendChild(title);

    const progressSteps = this.createElement('div', [styles.progressSteps]);

    PROGRESS_STEPS.forEach((step) => {
      const status = this.getStepStatus(step.id);
      const stepClass =
        status === 'active'
          ? styles.progressStepActive
          : status === 'done'
          ? styles.progressStepDone
          : styles.progressStepPending;

      const stepEl = this.createElement('div', [styles.progressStep, stepClass]);

      // Icon
      const iconContainer = this.createElement('div', [styles.progressIcon]);
      if (status === 'done') {
        const doneIcon = this.createElement('div', [styles.progressIconDone]);
        const checkSvg = this.createSVG('M5 13l4 4L19 7', [
          styles.progressIconDoneCheck,
        ]);
        checkSvg.setAttribute('stroke-width', '3');
        doneIcon.appendChild(checkSvg);
        iconContainer.appendChild(doneIcon);
      } else if (status === 'active') {
        const spinner = this.createElement('div', [styles.progressIconActive]);
        iconContainer.appendChild(spinner);
      } else {
        const pending = this.createElement('div', [styles.progressIconPending]);
        iconContainer.appendChild(pending);
      }

      // Content
      const content = this.createElement('div', [styles.progressContent]);
      const label = this.createElement('p', [
        styles.progressLabel,
        status === 'active'
          ? styles.progressLabelActive
          : status === 'done'
          ? styles.progressLabelDone
          : styles.progressLabelPending,
      ]);
      label.textContent = step.label;
      content.appendChild(label);

      if (step.endpoint) {
        const endpoint = this.createElement('p', [
          styles.progressEndpoint,
          status === 'active'
            ? styles.progressEndpointActive
            : styles.progressEndpointInactive,
        ]);
        endpoint.textContent = `→ ${step.endpoint}`;
        content.appendChild(endpoint);
      }

      stepEl.appendChild(iconContainer);
      stepEl.appendChild(content);
      progressSteps.appendChild(stepEl);
    });

    container.appendChild(progressSteps);

    const footer = this.createElement('p', [styles.progressFooter]);
    footer.textContent = 'No data is sent to our servers';
    container.appendChild(footer);
  }

  private renderDoneState(container: HTMLElement): void {
    if (!this.state.createdVault) return;

    container.className = `${styles.card} ${styles.cardCenter}`;

    // Icon
    const iconContainer = this.createElement('div', [styles.iconContainerLg]);
    const icon = this.createSVG('M5 13l4 4L19 7', [styles.icon]);
    iconContainer.appendChild(icon);
    container.appendChild(iconContainer);

    // Title
    const title = this.createElement('h2', [styles.successTitle]);
    title.textContent = this.state.createdVault.name
      ? `"${this.state.createdVault.name}" Created!`
      : 'Vault Created!';
    container.appendChild(title);

    // Message
    const message = this.createElement('p', [styles.successMessage]);
    const unlockTime = this.timeSelector?.getValue();
    message.textContent = `Your secret is locked until ${unlockTime?.toLocaleString()}`;
    if (this.state.createdVault.destroyAfterRead) {
      const notice = this.createElement('span', [styles.destroyNotice]);
      notice.textContent = 'This vault will be destroyed after reading';
      message.appendChild(notice);
    }
    container.appendChild(message);

    // Shareable link
    const linkContainer = this.createElement('div', [styles.linkContainer]);
    const linkLabel = this.createElement('p', [styles.linkLabel]);
    linkLabel.textContent = 'Shareable Link';
    const linkText = this.createElement('code', [styles.linkText]);
    linkText.textContent = getShareableUrl(this.state.createdVault);
    linkContainer.appendChild(linkLabel);
    linkContainer.appendChild(linkText);
    container.appendChild(linkContainer);

    // Buttons
    const buttonRow = this.createElement('div', [styles.buttonRow]);
    const copyBtn = this.createElement('button', [
      'btn-primary',
      styles.buttonFlex,
    ]);
    copyBtn.textContent = 'Copy Link';
    copyBtn.addEventListener('click', () => this.handleCopy());
    buttonRow.appendChild(copyBtn);

    container.appendChild(buttonRow);

    // Done button
    const doneBtn = this.createElement('button', ['btn-ghost', styles.doneButton]);
    doneBtn.textContent = 'Done — Create Another';
    doneBtn.addEventListener('click', () => this.handleReset());
    container.appendChild(doneBtn);

    // Verification section
    this.renderVerificationSection(container);
  }

  private renderVerificationSection(container: HTMLElement): void {
    const section = this.createElement('div', [styles.verificationSection]);
    const list = this.createElement('div', [styles.verificationList]);

    const items = [
      'Encrypted in your browser',
      'Stored in shareable link (no external service)',
      'Time-locked via Lit Protocol',
      'Zero server storage',
    ];

    items.forEach((text) => {
      const item = this.createElement('div', [styles.verificationItem]);
      const icon = this.createSVG('M5 13l4 4L19 7', [styles.checkIcon]);
      icon.setAttribute('stroke-width', '2');
      const span = this.createElement('span', [styles.verificationText]);
      span.textContent = text;
      item.appendChild(icon);
      item.appendChild(span);
      list.appendChild(item);
    });

    section.appendChild(list);

    const footer = this.createElement('p', [styles.verificationFooter]);
    footer.textContent = 'No early access — not for anyone, including us.';
    section.appendChild(footer);

    container.appendChild(section);
  }

  private getStepStatus(stepId: string): 'pending' | 'active' | 'done' {
    const stepIndex = PROGRESS_STEPS.findIndex((s) => s.id === stepId);
    const currentIndex = PROGRESS_STEPS.findIndex(
      (s) => s.id === this.state.currentProgressStep,
    );
    if (stepIndex < currentIndex) return 'done';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  }

  protected update(): void {
    this.renderCurrentStep(this.element);
  }

  private async handleCreate(): Promise<void> {
    const unlockTime = this.timeSelector?.getValue();
    const hasContent = this.state.secretText.trim();
    if (!hasContent || !unlockTime) return;

    const estimatedSize =
      new TextEncoder().encode(this.state.secretText).length * 1.5;
    const tooLarge = estimatedSize > MAX_VAULT_SIZE;

    if (tooLarge) {
      this.setState({
        error: `Secret is too large. Maximum size is ${Math.floor(MAX_VAULT_SIZE / 1024)}KB.`,
      });
      return;
    }

    this.setState({ error: null, step: 'creating' });

    const minDelay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    try {
      // Encrypt the secret locally
      this.setState({ currentProgressStep: 'encrypt' });
      const [symmetricKey] = await Promise.all([generateKey(), minDelay(600)]);
      const encryptedData = await encrypt(this.state.secretText, symmetricKey);
      const rawKey = await exportKey(symmetricKey);

      // Initialize Lit Protocol
      this.setState({ currentProgressStep: 'lit' });
      await Promise.all([initLit(), minDelay(600)]);

      // Store encrypted data in URL (inline storage)
      this.setState({ currentProgressStep: 'store' });
      const inlineData = toBase64(encryptedData);
      await minDelay(400);

      // Store key in Lit with time condition
      this.setState({ currentProgressStep: 'timelock' });
      const unlockTimeMs = unlockTime.getTime();
      const [{ encryptedKey, encryptedKeyHash }] = await Promise.all([
        encryptKeyWithTimelock(rawKey, unlockTimeMs),
        minDelay(600),
      ]);

      // Create vault reference
      const vault: VaultRef = {
        id: crypto.randomUUID(),
        unlockTime: unlockTimeMs,
        litEncryptedKey: encryptedKey,
        litKeyHash: encryptedKeyHash,
        createdAt: Date.now(),
        name: this.state.vaultName.trim() || undefined,
        inlineData,
        destroyAfterRead: this.state.destroyAfterRead,
      };

      // Save locally for easy access
      this.setState({ currentProgressStep: 'save' });
      await Promise.all([saveVaultRef(vault), minDelay(400)]);

      this.setState({ createdVault: vault, step: 'done' });
      this.onVaultCreated?.(vault);
    } catch (err) {
      console.error('Vault creation error:', err);
      const friendlyError = getFriendlyError(
        err instanceof Error ? err : new Error(String(err)),
      );
      this.setState({ error: friendlyError.message, step: 'input' });
    }
  }

  private handleCopy(): void {
    if (this.state.createdVault) {
      navigator.clipboard.writeText(getShareableUrl(this.state.createdVault));
      eventBus.emit('toast:show', 'Link copied!');
    }
  }

  private handleReset(): void {
    if (this.timeSelector) {
      this.timeSelector.unmount();
    }
    this.timeSelector = null;
    
    this.setState({
      vaultName: '',
      secretText: '',
      step: 'input',
      createdVault: null,
      currentProgressStep: '',
      error: null,
      destroyAfterRead: false,
    });
  }
}

