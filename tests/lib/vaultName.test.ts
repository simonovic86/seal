import { describe, it, expect } from 'vitest';
import { resolveVaultName, resolveVaultNameForCreatedAt } from '../../src/lib/vaultName';

describe('vaultName', () => {
  describe('resolveVaultName', () => {
    it('should return provided name if not empty', () => {
      const result = resolveVaultName('My Custom Vault');
      expect(result).toBe('My Custom Vault');
    });

    it('should trim whitespace', () => {
      const result = resolveVaultName('  Trimmed  ');
      expect(result).toBe('Trimmed');
    });

    it('should generate default name for empty string', () => {
      const result = resolveVaultName('');
      expect(result).toMatch(/^Vault – \d{4}-\d{2}-\d{2}$/);
    });

    it('should generate default name for whitespace-only string', () => {
      const result = resolveVaultName('   ');
      expect(result).toMatch(/^Vault – \d{4}-\d{2}-\d{2}$/);
    });

    it('should generate default name for undefined', () => {
      const result = resolveVaultName(undefined);
      expect(result).toMatch(/^Vault – \d{4}-\d{2}-\d{2}$/);
    });

    it('should use provided date for default name', () => {
      const date = new Date('2026-01-27');
      const result = resolveVaultName('', date);
      expect(result).toBe('Vault – 2026-01-27');
    });

    it('should format date correctly', () => {
      const date = new Date('2026-03-05');
      const result = resolveVaultName(undefined, date);
      expect(result).toBe('Vault – 2026-03-05');
    });
  });

  describe('resolveVaultNameForCreatedAt', () => {
    it('should use createdAt timestamp if provided', () => {
      const timestamp = new Date('2026-01-27').getTime();
      const result = resolveVaultNameForCreatedAt(undefined, timestamp);
      expect(result).toBe('Vault – 2026-01-27');
    });

    it('should return custom name if provided', () => {
      const timestamp = new Date('2026-01-27').getTime();
      const result = resolveVaultNameForCreatedAt('Custom Name', timestamp);
      expect(result).toBe('Custom Name');
    });

    it('should use current date if createdAt is 0', () => {
      const result = resolveVaultNameForCreatedAt(undefined, 0);
      expect(result).toMatch(/^Vault – \d{4}-\d{2}-\d{2}$/);
    });

    it('should use current date if createdAt is undefined', () => {
      const result = resolveVaultNameForCreatedAt(undefined, undefined);
      expect(result).toMatch(/^Vault – \d{4}-\d{2}-\d{2}$/);
    });

    it('should handle negative timestamps', () => {
      const result = resolveVaultNameForCreatedAt(undefined, -1);
      // Should use current date for invalid timestamps
      expect(result).toMatch(/^Vault – \d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('date formatting', () => {
    it('should pad month with zero', () => {
      const date = new Date('2026-03-15');
      const result = resolveVaultName('', date);
      expect(result).toBe('Vault – 2026-03-15');
    });

    it('should pad day with zero', () => {
      const date = new Date('2026-12-05');
      const result = resolveVaultName('', date);
      expect(result).toBe('Vault – 2026-12-05');
    });

    it('should handle year 2000+', () => {
      const date = new Date('2099-12-31');
      const result = resolveVaultName('', date);
      expect(result).toBe('Vault – 2099-12-31');
    });
  });
});
