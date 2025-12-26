/**
 * Time selector component (Vanilla JS)
 */

import { Component } from '@/lib/component';
import styles from '../components/TimeSelector.module.css';

const PRESETS = [
  { label: '1h', hours: 1 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 24 * 7 },
  { label: '30d', hours: 24 * 30 },
] as const;

type PresetHours = (typeof PRESETS)[number]['hours'];
type Selection = PresetHours | 'custom' | null;

interface TimeSelectorState {
  value: Date | null;
  selection: Selection;
  minDateString: string;
}

export class TimeSelector extends Component<TimeSelectorState> {
  private onChange: (date: Date) => void;

  constructor(onChange: (date: Date) => void) {
    const minDate = new Date(Date.now() + 60 * 1000);
    super({
      value: null,
      selection: null,
      minDateString: minDate.toISOString().slice(0, 16),
    });
    this.onChange = onChange;
  }

  protected render(): HTMLElement {
    const container = this.createElement('div', [styles.container]);

    // Label
    const label = this.createElement('label', [styles.label]);
    label.textContent = 'Lock until';
    container.appendChild(label);

    // Segmented control
    const segmentedControl = this.createElement('div', [
      styles.segmentedControl,
    ]);

    PRESETS.forEach((preset) => {
      const button = this.createElement('button', [styles.pill]);
      button.textContent = preset.label;
      button.setAttribute('type', 'button');
      button.addEventListener('click', () => this.handlePreset(preset.hours));
      segmentedControl.appendChild(button);
    });

    const customButton = this.createElement('button', [styles.pill]);
    customButton.textContent = 'Custom';
    customButton.setAttribute('type', 'button');
    customButton.addEventListener('click', () => this.handleCustomClick());
    segmentedControl.appendChild(customButton);

    container.appendChild(segmentedControl);

    // Custom datetime input (hidden by default)
    const customInput = this.createElement('input', [styles.customInput]);
    customInput.setAttribute('type', 'datetime-local');
    customInput.setAttribute('min', this.state.minDateString);
    customInput.style.display = 'none';
    customInput.addEventListener('change', (e) =>
      this.handleCustomChange(e as Event),
    );
    container.appendChild(customInput);

    // Unlock time display
    const unlockTime = this.createElement('p', [styles.unlockTime]);
    unlockTime.style.display = 'none';
    container.appendChild(unlockTime);

    return container;
  }

  protected update(): void {
    // Update button states
    const buttons = this.element.querySelectorAll('button');
    buttons.forEach((button, index) => {
      if (index < PRESETS.length) {
        const isActive = this.state.selection === PRESETS[index].hours;
        button.className = isActive
          ? `${styles.pill} ${styles.pillActive}`
          : styles.pill;
      } else {
        // Custom button
        const isActive = this.state.selection === 'custom';
        button.className = isActive
          ? `${styles.pill} ${styles.pillActive}`
          : styles.pill;
      }
    });

    // Show/hide custom input
    const customInput = this.element.querySelector(
      'input[type="datetime-local"]',
    ) as HTMLInputElement;
    if (customInput) {
      customInput.style.display =
        this.state.selection === 'custom' ? 'block' : 'none';
    }

    // Update unlock time display
    const unlockTimeEl = this.element.querySelector(
      `.${styles.unlockTime}`,
    ) as HTMLElement;
    if (unlockTimeEl) {
      if (this.state.value) {
        const formatted = this.state.value.toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
        unlockTimeEl.innerHTML = `Unlocks at: <span class="${styles.unlockTimeValue}">${formatted}</span>`;
        unlockTimeEl.style.display = 'block';
      } else {
        unlockTimeEl.style.display = 'none';
      }
    }
  }

  private handlePreset(hours: PresetHours): void {
    this.setState({ selection: hours });
    const date = new Date(Date.now() + hours * 60 * 60 * 1000);
    this.setState({ value: date });
    this.onChange(date);
  }

  private handleCustomClick(): void {
    this.setState({ selection: 'custom' });
  }

  private handleCustomChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const date = new Date(input.value);
    if (!isNaN(date.getTime())) {
      this.setState({ value: date });
      this.onChange(date);
    }
  }

  getValue(): Date | null {
    return this.state.value;
  }
}

