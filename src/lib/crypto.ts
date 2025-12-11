/**
 * Client-side AES-256-GCM encryption using Web Crypto API
 * No external dependencies - uses native browser APIs
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for GCM

/**
 * Generate a random 256-bit AES key
 */
export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable - we need to export it for Lit
    ['encrypt', 'decrypt'],
  );
}

/**
 * Export CryptoKey to raw bytes
 */
export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

/**
 * Import raw bytes as CryptoKey
 */
export async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  // Create a fresh ArrayBuffer to avoid SharedArrayBuffer type issues
  const keyBuffer = new ArrayBuffer(raw.byteLength);
  new Uint8Array(keyBuffer).set(raw);

  return crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt data with AES-256-GCM
 * Returns ciphertext with IV prepended (IV || ciphertext)
 */
export async function encrypt(
  data: ArrayBuffer | string,
  key: CryptoKey,
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const plaintext =
    typeof data === 'string' ? new TextEncoder().encode(data) : data;

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    plaintext,
  );

  // Prepend IV to ciphertext
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.length);

  return result;
}

/**
 * Decrypt data encrypted with AES-256-GCM
 * Expects IV prepended to ciphertext (IV || ciphertext)
 */
export async function decrypt(
  encryptedData: Uint8Array,
  key: CryptoKey,
): Promise<ArrayBuffer> {
  const iv = encryptedData.slice(0, IV_LENGTH);
  const ciphertext = encryptedData.slice(IV_LENGTH);

  return crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
}

/**
 * Decrypt to string (for text secrets)
 */
export async function decryptToString(
  encryptedData: Uint8Array,
  key: CryptoKey,
): Promise<string> {
  const decrypted = await decrypt(encryptedData, key);
  return new TextDecoder().decode(decrypted);
}

/**
 * Convert Uint8Array to base64 string
 */
export function toBase64(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data));
}

/**
 * Convert base64 string to Uint8Array
 */
export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

