/**
 * Test setup file for Vitest
 * Runs before all tests
 */

import { afterEach, beforeEach } from 'vitest';

// Mock Web Crypto API if not available
if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = await import('node:crypto');
  // @ts-expect-error - Polyfill for Node.js
  globalThis.crypto = webcrypto;
}

// Mock browser APIs
beforeEach(() => {
  // Reset any mocks or state before each test
});

afterEach(() => {
  // Cleanup after each test
});
