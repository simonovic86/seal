/**
 * Toast notification component (Vanilla JS)
 */

import { Component, eventBus } from '@/lib/component';
import styles from '../styles/toast.module.css';

interface ToastState {
  message: string;
  visible: boolean;
}

export class Toast extends Component<ToastState> {
  private hideTimer: number | null = null;
  private duration: number;

  constructor(message: string, duration = 2000) {
    super({ message, visible: true });
    this.duration = duration;
  }

  protected render(): HTMLElement {
    const container = this.createElement('div', [styles.toast]);

    const content = this.createElement('div', [styles.content]);

    // Check icon
    const icon = this.createSVG(
      'M5 13l4 4L19 7',
      [styles.icon],
    );
    icon.setAttribute('stroke-width', '2');

    content.appendChild(icon);

    const messageEl = this.createElement('span');
    messageEl.textContent = this.state.message;
    content.appendChild(messageEl);

    container.appendChild(content);

    return container;
  }

  protected update(): void {
    const messageEl = this.element.querySelector('span');
    if (messageEl) {
      messageEl.textContent = this.state.message;
    }

    if (!this.state.visible) {
      this.unmount();
    }
  }

  protected onMount(): void {
    this.hideTimer = window.setTimeout(() => {
      this.hide();
    }, this.duration);
  }

  protected onUnmount(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }
  }

  private hide(): void {
    this.setState({ visible: false });
  }
}

/**
 * Global toast manager
 */
class ToastManager {
  private container: HTMLElement | null = null;

  private ensureContainer(): HTMLElement {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  show(message: string, duration = 2000): void {
    const container = this.ensureContainer();
    const toast = new Toast(message, duration);
    toast.mount(container);
  }
}

export const toastManager = new ToastManager();

// Global event listener for toast events
eventBus.on('toast:show', (message: string) => {
  toastManager.show(message);
});

