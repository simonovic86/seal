/**
 * CreateVaultForm - UI Component
 *
 * This component handles the user interface for vault creation.
 * All domain logic (encryption, time-locking, persistence) is delegated
 * to the vaultCreation module.
 *
 * ============================================================================
 * UI FLOW (linear, no hidden logic)
 * ============================================================================
 *
 * 1. FORM     → User enters secret + unlock time
 * 2. ENCRYPT  → createDraft() - local encryption only
 * 3. DRAFT    → User reviews, can Discard or Arm
 * 4. ARM      → armDraft() - POINT OF NO RETURN
 * 5. DONE     → Vault created, draft wiped, form reset
 *
 * The UI is intentionally thin. It:
 * - Collects user input
 * - Calls domain functions
 * - Renders the current state
 *
 * It does NOT contain business logic about encryption or commitment.
 */

import { Component } from '../lib/component';
import { VaultDraft, createDraft, armDraft, wipeDraft } from '../lib/vaultCreation';
import { VaultRef } from '../lib/storage';
import { resolveVaultName } from '../lib/vaultName';
import styles from '../styles/create-vault-form.module.css';

// ============================================================================
// State
// ============================================================================

type Step = 'form' | 'encrypting' | 'draft' | 'arming';

interface State {
  step: Step;
  error: string | null;
  // Form fields
  name: string;
  secret: string;
  unlockDate: string;
  unlockTime: string;
  destroyAfterRead: boolean;
}

// ============================================================================
// Component
// ============================================================================

export class CreateVaultForm extends Component<State> {
  private onVaultCreated: (vault: VaultRef) => void;

  /**
   * Draft lives ONLY in memory.
   * Set after createDraft(), cleared after armDraft() or discard.
   */
  private draft: VaultDraft | null = null;

  constructor(onVaultCreated: (vault: VaultRef) => void) {
    super({
      step: 'form',
      error: null,
      name: resolveVaultName(),
      secret: '',
      unlockDate: '',
      unlockTime: '',
      destroyAfterRead: false,
    });
    this.onVaultCreated = onVaultCreated;
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  protected render(): HTMLElement {
    const container = this.createElement('div', [styles.card]);
    this.renderCurrentStep(container);
    return container;
  }

  protected update(): void {
    this.element.innerHTML = '';
    this.renderCurrentStep(this.element);
  }

  // ==========================================================================
  // Step Rendering (intentionally dumb - just displays current state)
  // ==========================================================================

  private renderCurrentStep(container: HTMLElement): void {
    switch (this.state.step) {
      case 'form':
        this.renderFormStep(container);
        break;
      case 'encrypting':
        this.renderEncryptingStep(container);
        break;
      case 'draft':
        this.renderDraftStep(container);
        break;
      case 'arming':
        this.renderArmingStep(container);
        break;
    }
  }

  private renderFormStep(container: HTMLElement): void {
    const heading = this.createElement('h2', [styles.heading]);
    heading.textContent = 'Create a Vault';
    container.appendChild(heading);

    const form = this.createElement('form', [styles.form]);
    form.addEventListener('submit', (e) => this.handlePrepareVault(e));

    // Name input (optional)
    const nameField = this.createElement('div', [styles.field]);
    const nameLabel = this.createElement('label', [styles.fieldLabel]);
    nameLabel.innerHTML = `Vault Name <span class="${styles.optionalText}">(optional)</span>`;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = styles.input;
    nameInput.value = resolveVaultName(this.state.name);
    nameInput.addEventListener('input', (e) => {
      const rawValue = (e.target as HTMLInputElement).value;
      const resolved = resolveVaultName(rawValue);
      this.state.name = resolved;
      if (resolved !== rawValue) {
        (e.target as HTMLInputElement).value = resolved;
      }
    });
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);
    form.appendChild(nameField);

    // Secret textarea
    const secretField = this.createElement('div', [styles.field]);
    const secretLabel = this.createElement('label', [styles.fieldLabel]);
    secretLabel.textContent = 'Your Secret';
    const secretTextarea = document.createElement('textarea');
    secretTextarea.className = `${styles.input} ${styles.textarea}`;
    secretTextarea.placeholder = 'Enter your secret message...';
    secretTextarea.required = true;
    secretTextarea.rows = 4;
    secretTextarea.value = this.state.secret;
    secretTextarea.addEventListener('input', (e) => {
      this.state.secret = (e.target as HTMLTextAreaElement).value;
    });
    secretField.appendChild(secretLabel);
    secretField.appendChild(secretTextarea);
    form.appendChild(secretField);

    // Date field
    const dateField = this.createElement('div', [styles.field]);
    const dateLabel = this.createElement('label', [styles.fieldLabel]);
    dateLabel.textContent = 'Unlock Date';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = styles.input;
    dateInput.required = true;
    dateInput.value = this.state.unlockDate;
    dateInput.min = new Date().toISOString().split('T')[0];
    dateInput.addEventListener('input', (e) => {
      this.state.unlockDate = (e.target as HTMLInputElement).value;
    });
    dateField.appendChild(dateLabel);
    dateField.appendChild(dateInput);
    form.appendChild(dateField);

    // Time field
    const timeField = this.createElement('div', [styles.field]);
    const timeLabel = this.createElement('label', [styles.fieldLabel]);
    timeLabel.textContent = 'Unlock Time';
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.className = styles.input;
    timeInput.required = true;
    timeInput.value = this.state.unlockTime;
    timeInput.addEventListener('input', (e) => {
      this.state.unlockTime = (e.target as HTMLInputElement).value;
    });
    timeField.appendChild(timeLabel);
    timeField.appendChild(timeInput);
    form.appendChild(timeField);

    // Destroy after read checkbox
    const checkboxWrapper = this.createElement('label', [styles.checkboxLabel]);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = styles.checkbox;
    checkbox.checked = this.state.destroyAfterRead;
    checkbox.addEventListener('change', (e) => {
      this.state.destroyAfterRead = (e.target as HTMLInputElement).checked;
    });
    const checkboxText = this.createElement('span', [styles.checkboxText]);
    checkboxText.textContent = 'Destroy after reading';
    checkboxWrapper.appendChild(checkbox);
    checkboxWrapper.appendChild(checkboxText);
    form.appendChild(checkboxWrapper);

    // Error display
    if (this.state.error) {
      const errorDiv = this.createElement('div', [styles.error]);
      errorDiv.textContent = this.state.error;
      form.appendChild(errorDiv);
    }

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn-primary';
    submitBtn.textContent = 'Prepare Vault';
    form.appendChild(submitBtn);

    container.appendChild(form);
  }

  private renderEncryptingStep(container: HTMLElement): void {
    const title = this.createElement('h2', [styles.progressTitle]);
    title.textContent = 'Encrypting';
    container.appendChild(title);

    const spinner = this.createElement('div', [styles.progressIconActive]);
    spinner.style.margin = '2rem auto';
    container.appendChild(spinner);

    const text = this.createElement('p', [styles.progressFooter]);
    text.textContent = 'Preparing your vault...';
    container.appendChild(text);
  }

  private renderDraftStep(container: HTMLElement): void {
    if (!this.draft) {
      this.resetForm();
      return;
    }

    const heading = this.createElement('h2', [styles.heading]);
    heading.textContent = 'Vault Ready';
    container.appendChild(heading);

    // Info card showing unlock time
    const infoCard = this.createElement('div', [styles.linkContainer]);

    const unlockLabel = this.createElement('p', [styles.linkLabel]);
    unlockLabel.textContent = 'Unlock Time';
    const unlockValue = this.createElement('p', [styles.linkText]);
    unlockValue.textContent = new Date(this.draft.unlockTime).toLocaleString();
    infoCard.appendChild(unlockLabel);
    infoCard.appendChild(unlockValue);

    if (this.draft.destroyAfterRead) {
      const destroyNote = this.createElement('p', [styles.hint]);
      destroyNote.textContent = 'Will be destroyed after reading';
      destroyNote.style.marginTop = '0.5rem';
      infoCard.appendChild(destroyNote);
    }

    container.appendChild(infoCard);

    // Error display
    if (this.state.error) {
      const errorDiv = this.createElement('div', [styles.error]);
      errorDiv.textContent = this.state.error;
      container.appendChild(errorDiv);
    }

    // Action buttons: Discard or Arm
    const buttonRow = this.createElement('div', [styles.buttonRow]);

    const discardBtn = document.createElement('button');
    discardBtn.type = 'button';
    discardBtn.className = `btn-secondary ${styles.buttonFlex}`;
    discardBtn.textContent = 'Discard';
    discardBtn.addEventListener('click', () => this.handleDiscard());
    buttonRow.appendChild(discardBtn);

    const armBtn = document.createElement('button');
    armBtn.type = 'button';
    armBtn.className = `btn-primary ${styles.buttonFlex}`;
    armBtn.textContent = 'Arm Vault';
    armBtn.addEventListener('click', () => this.handleArmVault());
    buttonRow.appendChild(armBtn);

    container.appendChild(buttonRow);
  }

  private renderArmingStep(container: HTMLElement): void {
    const title = this.createElement('h2', [styles.progressTitle]);
    title.textContent = 'Arming Vault';
    container.appendChild(title);

    const steps = this.createElement('div', [styles.progressSteps]);

    const stepConfigs = [{ label: 'Creating time lock' }, { label: 'Finalizing vault' }];

    stepConfigs.forEach((stepConfig) => {
      const stepDiv = this.createElement('div', [styles.progressStep, styles.progressStepActive]);

      const iconDiv = this.createElement('div', [styles.progressIcon]);
      const spinner = this.createElement('div', [styles.progressIconActive]);
      iconDiv.appendChild(spinner);
      stepDiv.appendChild(iconDiv);

      const labelDiv = this.createElement('div', [
        styles.progressLabel,
        styles.progressLabelActive,
      ]);
      labelDiv.textContent = stepConfig.label;
      stepDiv.appendChild(labelDiv);

      steps.appendChild(stepDiv);
    });

    container.appendChild(steps);

    const footer = this.createElement('p', [styles.progressFooter]);
    footer.textContent = 'This cannot be undone...';
    container.appendChild(footer);
  }

  // ==========================================================================
  // Actions (thin handlers that delegate to domain functions)
  // ==========================================================================

  /**
   * Step 1: Prepare vault (create draft)
   *
   * Collect input → Validate → Create draft → Show draft view
   */
  private async handlePrepareVault(e: Event): Promise<void> {
    e.preventDefault();

    const { name, secret, unlockDate, unlockTime, destroyAfterRead } = this.state;

    // Parse and validate unlock time
    const unlockDateTime = new Date(`${unlockDate}T${unlockTime}`);
    const unlockTimeMs = unlockDateTime.getTime();

    if (unlockTimeMs <= Date.now()) {
      this.setState({ error: 'Unlock time must be in the future' });
      return;
    }

    try {
      this.setState({ step: 'encrypting', error: null });

      // Delegate to domain function - creates draft in memory
      this.draft = await createDraft({
        name,
        secret,
        unlockTime: unlockTimeMs,
        destroyAfterRead,
      });

      // Clear secret from UI state immediately
      this.setState({
        step: 'draft',
        name: resolveVaultName(),
        secret: '',
        error: null,
      });
    } catch (err) {
      console.error('Failed to create draft:', err);
      this.setState({
        step: 'form',
        error: err instanceof Error ? err.message : 'Encryption failed',
      });
    }
  }

  /**
   * Discard draft and return to form
   *
   * Wipe draft → Reset form
   */
  private handleDiscard(): void {
    if (this.draft) {
      wipeDraft(this.draft);
      this.draft = null;
    }
    this.resetForm();
  }

  /**
   * Step 2: Arm vault (IRREVERSIBLE)
   *
   * Arm draft → Wipe draft → Notify parent → Reset form
   *
   * After this completes, the vault exists and cannot be undone.
   */
  private async handleArmVault(): Promise<void> {
    if (!this.draft) {
      this.resetForm();
      return;
    }

    // Hold reference to draft - after arming starts, we're committed
    const draftToArm = this.draft;

    try {
      this.setState({ step: 'arming', error: null });

      // === POINT OF NO RETURN ===
      // armDraft creates tlock encryption and persists the vault
      const vault = await armDraft(draftToArm);

      // === WIPE SENSITIVE DATA ===
      wipeDraft(draftToArm);
      this.draft = null;

      // Notify parent and reset
      this.onVaultCreated(vault);
      this.resetForm();
    } catch (err) {
      console.error('Failed to arm vault:', err);
      // On error, draft remains - user can retry or discard
      this.setState({
        step: 'draft',
        error: err instanceof Error ? err.message : 'Failed to arm vault',
      });
    }
  }

  /**
   * Reset to initial form state
   */
  private resetForm(): void {
    this.setState({
      step: 'form',
      error: null,
      name: resolveVaultName(),
      secret: '',
      unlockDate: '',
      unlockTime: '',
      destroyAfterRead: false,
    });
  }
}
