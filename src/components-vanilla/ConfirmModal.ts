/**
 * Confirmation modal component (Vanilla JS)
 */

import { Component } from '@/lib/component';
import styles from '../styles/confirm-modal.module.css';
import '../styles/shared.css';

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
}

export class ConfirmModal extends Component<ConfirmModalState> {
  private onConfirm: () => void;
  private onCancel: () => void;
  private handleKeydown: (e: KeyboardEvent) => void;

  constructor(options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) {
    super({
      isOpen: false,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText ?? 'Confirm',
      cancelText: options.cancelText ?? 'Cancel',
    });

    this.onConfirm = options.onConfirm;
    this.onCancel = options.onCancel;

    this.handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.state.isOpen) {
        this.cancel();
      }
    };
  }

  protected render(): HTMLElement {
    const overlay = this.createElement('div', [styles.overlay]);
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'modal-title');
    overlay.style.display = 'none';

    // Backdrop
    const backdrop = this.createElement('div', [styles.backdrop]);
    backdrop.addEventListener('click', () => this.cancel());

    // Modal
    const modal = this.createElement('div', [styles.modal]);
    modal.setAttribute('tabindex', '-1');

    const content = this.createElement('div', [styles.content]);

    // Icon
    const iconContainer = this.createElement('div', [styles.iconContainer]);
    const icon = this.createSVG(
      'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      [styles.icon],
    );
    iconContainer.appendChild(icon);

    // Title
    const title = this.createElement('h2', [styles.title]);
    title.id = 'modal-title';
    title.textContent = this.state.title;

    // Message
    const message = this.createElement('p', [styles.message]);
    message.textContent = this.state.message;

    // Actions
    const actions = this.createElement('div', [styles.actions]);

    const cancelBtn = this.createElement('button', ['btn-secondary', styles.cancelButton]);
    cancelBtn.textContent = this.state.cancelText;
    cancelBtn.addEventListener('click', () => this.cancel());

    const confirmBtn = this.createElement('button', ['btn-primary', styles.confirmButton]);
    confirmBtn.textContent = this.state.confirmText;
    confirmBtn.addEventListener('click', () => this.confirm());

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    content.appendChild(iconContainer);
    content.appendChild(title);
    content.appendChild(message);
    content.appendChild(actions);

    modal.appendChild(content);
    overlay.appendChild(backdrop);
    overlay.appendChild(modal);

    return overlay;
  }

  protected update(): void {
    this.element.style.display = this.state.isOpen ? 'flex' : 'none';

    if (this.state.isOpen) {
      const modal = this.element.querySelector(`.${styles.modal}`) as HTMLElement;
      modal?.focus();
    }
  }

  protected onMount(): void {
    document.addEventListener('keydown', this.handleKeydown);
  }

  protected onUnmount(): void {
    document.removeEventListener('keydown', this.handleKeydown);
  }

  open(): void {
    this.setState({ isOpen: true });
  }

  close(): void {
    this.setState({ isOpen: false });
  }

  private confirm(): void {
    this.close();
    this.onConfirm();
  }

  private cancel(): void {
    this.close();
    this.onCancel();
  }
}

/**
 * Helper to show confirm modal with Promise
 */
export function confirm(
  title: string,
  message: string,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = new ConfirmModal({
      title,
      message,
      confirmText,
      cancelText,
      onConfirm: () => {
        modal.unmount();
        resolve(true);
      },
      onCancel: () => {
        modal.unmount();
        resolve(false);
      },
    });

    modal.mount(document.body);
    modal.open();
  });
}
