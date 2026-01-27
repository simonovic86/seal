import { describe, it, expect } from 'vitest';
import { toBase64, fromBase64 } from '../../src/lib/encoding';

describe('encoding', () => {
  describe('toBase64', () => {
    it('should encode empty Uint8Array', () => {
      const data = new Uint8Array([]);
      const result = toBase64(data);
      expect(result).toBe('');
    });

    it('should encode Uint8Array to base64', () => {
      const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result = toBase64(data);
      expect(result).toBe('SGVsbG8');
    });

    it('should produce URL-safe base64 (no + or /)', () => {
      // Characters that would produce + and / in standard base64
      const data = new Uint8Array([255, 255, 255]);
      const result = toBase64(data);
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
      expect(result).toContain('_'); // URL-safe replacement for /
    });

    it('should not include padding', () => {
      const data = new Uint8Array([72, 101]); // "He"
      const result = toBase64(data);
      expect(result).not.toContain('=');
    });

    it('should handle binary data', () => {
      const data = new Uint8Array([0, 1, 2, 3, 255, 254, 253]);
      const result = toBase64(data);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('fromBase64', () => {
    it('should decode base64 to Uint8Array', () => {
      const result = fromBase64('SGVsbG8');
      expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it('should handle URL-safe base64', () => {
      const original = new Uint8Array([255, 255, 255]);
      const encoded = toBase64(original);
      const decoded = fromBase64(encoded);
      expect(decoded).toEqual(original);
    });

    it('should handle missing padding', () => {
      // Base64 without padding should still decode correctly
      const result = fromBase64('SGVsbG8'); // No padding needed
      expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it('should roundtrip encode/decode', () => {
      const testCases = [
        new Uint8Array([]),
        new Uint8Array([0]),
        new Uint8Array([255]),
        new Uint8Array([0, 1, 2, 3, 4, 5]),
        new Uint8Array(Array.from({ length: 256 }, (_, i) => i)),
      ];

      for (const original of testCases) {
        const encoded = toBase64(original);
        const decoded = fromBase64(encoded);
        expect(decoded).toEqual(original);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle large arrays', () => {
      const large = new Uint8Array(10000).fill(42);
      const encoded = toBase64(large);
      const decoded = fromBase64(encoded);
      expect(decoded).toEqual(large);
    });

    it('should handle all possible byte values', () => {
      const allBytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        allBytes[i] = i;
      }
      const encoded = toBase64(allBytes);
      const decoded = fromBase64(encoded);
      expect(decoded).toEqual(allBytes);
    });
  });
});
