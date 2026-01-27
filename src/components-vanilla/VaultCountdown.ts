/**
 * Vault countdown timer component (Vanilla JS)
 */

import { Component } from '@/lib/component';
import styles from '../styles/vault-countdown.module.css';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface VaultCountdownState {
  timeLeft: TimeLeft | null;
  unlockTime: number;
}

function calculateTimeLeft(unlockTime: number): TimeLeft | null {
  const diff = unlockTime - Date.now();
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / 1000 / 60) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export class VaultCountdown extends Component<VaultCountdownState> {
  private timer: number | null = null;
  private onUnlockReady?: () => void;

  constructor(unlockTime: number, onUnlockReady?: () => void) {
    super({
      timeLeft: calculateTimeLeft(unlockTime),
      unlockTime,
    });
    this.onUnlockReady = onUnlockReady;
  }

  protected render(): HTMLElement {
    const container = this.createElement('div', [styles.container]);

    if (!this.state.timeLeft) {
      return this.renderReady(container);
    }

    return this.renderCountdown(container);
  }

  private renderReady(container: HTMLElement): HTMLElement {
    const badge = this.createElement('div', [styles.badge, styles.badgeReady]);

    const icon = this.createSVG(
      'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
      [styles.badgeIcon],
    );

    const text = this.createElement('span', [styles.badgeText]);
    text.textContent = 'Ready to unlock';

    badge.appendChild(icon);
    badge.appendChild(text);
    container.appendChild(badge);

    return container;
  }

  private renderCountdown(container: HTMLElement): HTMLElement {
    // Badge
    const badge = this.createElement('div', [styles.badge]);
    const icon = this.createSVG(
      'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      [styles.badgeIcon],
    );
    const text = this.createElement('span', [styles.badgeText]);
    text.textContent = 'Vault is locked';
    badge.appendChild(icon);
    badge.appendChild(text);
    container.appendChild(badge);

    // Time blocks
    const timeBlocks = this.createElement('div', [styles.timeBlocks]);
    timeBlocks.id = 'time-blocks';

    if (this.state.timeLeft) {
      if (this.state.timeLeft.days > 0) {
        timeBlocks.appendChild(this.createTimeBlock(this.state.timeLeft.days, 'Days'));
      }
      timeBlocks.appendChild(this.createTimeBlock(this.state.timeLeft.hours, 'Hours'));
      timeBlocks.appendChild(this.createTimeBlock(this.state.timeLeft.minutes, 'Min'));
      timeBlocks.appendChild(this.createTimeBlock(this.state.timeLeft.seconds, 'Sec'));
    }

    container.appendChild(timeBlocks);

    // Unlock info
    const unlockInfo = this.createElement('p', [styles.unlockInfo]);
    unlockInfo.textContent = `Unlocks at ${new Date(this.state.unlockTime).toLocaleString()}`;
    container.appendChild(unlockInfo);

    return container;
  }

  private createTimeBlock(value: number, label: string): HTMLElement {
    const block = this.createElement('div', [styles.timeBlock]);

    const valueContainer = this.createElement('div', [styles.timeValue]);
    const numberEl = this.createElement('span', [styles.timeNumber]);
    numberEl.textContent = value.toString().padStart(2, '0');
    valueContainer.appendChild(numberEl);

    const labelEl = this.createElement('span', [styles.timeLabel]);
    labelEl.textContent = label;

    block.appendChild(valueContainer);
    block.appendChild(labelEl);

    return block;
  }

  protected update(): void {
    // Clear and re-render
    this.element.innerHTML = '';
    const newContent = !this.state.timeLeft
      ? this.renderReady(this.element)
      : this.renderCountdown(this.element);
  }

  protected onMount(): void {
    this.startTimer();
  }

  protected onUnmount(): void {
    this.stopTimer();
  }

  private startTimer(): void {
    this.timer = window.setInterval(() => {
      const newTimeLeft = calculateTimeLeft(this.state.unlockTime);
      this.setState({ timeLeft: newTimeLeft });

      if (!newTimeLeft) {
        this.stopTimer();
        this.onUnlockReady?.();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
