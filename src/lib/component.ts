/**
 * Base Component class for vanilla JS components
 * Provides state management and lifecycle methods
 */

export abstract class Component<T = any> {
  protected element: HTMLElement;
  protected state: T;
  private mounted = false;

  constructor(initialState: T) {
    this.state = initialState;
    this.element = this.render();
  }

  /**
   * Create and return the root DOM element
   */
  protected abstract render(): HTMLElement;

  /**
   * Update component state and trigger re-render
   */
  protected setState(newState: Partial<T>): void {
    this.state = { ...this.state, ...newState };
    this.update();
  }

  /**
   * Update the DOM to reflect state changes
   */
  protected abstract update(): void;

  /**
   * Mount component to a container
   */
  mount(container: HTMLElement | string): void {
    const target = typeof container === 'string' ? document.querySelector(container) : container;

    if (!target) {
      throw new Error('Mount target not found');
    }

    target.appendChild(this.element);
    this.mounted = true;
    this.onMount();
  }

  /**
   * Called after component is mounted to DOM
   */
  protected onMount(): void {
    // Override in subclasses if needed
  }

  /**
   * Remove component from DOM
   */
  unmount(): void {
    if (this.mounted && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
      this.mounted = false;
      this.onUnmount();
    }
  }

  /**
   * Cleanup when component is unmounted
   */
  protected onUnmount(): void {
    // Override in subclasses if needed
  }

  /**
   * Create an element with optional classes and attributes
   */
  protected createElement(
    tag: string,
    classes: string[] = [],
    attributes: Record<string, string> = {},
  ): HTMLElement {
    const el = document.createElement(tag);
    if (classes.length) {
      el.className = classes.join(' ');
    }
    Object.entries(attributes).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });
    return el;
  }

  /**
   * Helper to create SVG elements
   */
  protected createSVG(path: string, classes: string[] = []): SVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('viewBox', '0 0 24 24');
    if (classes.length) {
      svg.className.baseVal = classes.join(' ');
    }

    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('stroke-linecap', 'round');
    pathEl.setAttribute('stroke-linejoin', 'round');
    pathEl.setAttribute('stroke-width', '1.5');
    pathEl.setAttribute('d', path);

    svg.appendChild(pathEl);
    return svg;
  }
}

/**
 * Event bus for component communication
 */
class EventBus {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: string, data?: any): void {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }
}

export const eventBus = new EventBus();
