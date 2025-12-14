/**
 * IPFS storage via Pinata
 * 
 * For small vaults (<8KB), data is stored inline in the URL — no IPFS needed!
 * For larger vaults, we use Pinata for IPFS storage.
 * 
 * Setup:
 * 1. Create free account at https://pinata.cloud
 * 2. Get API key from dashboard
 * 3. Set NEXT_PUBLIC_PINATA_JWT environment variable
 */

import { withRetry } from './retry';
import { INLINE_DATA_THRESHOLD } from './storage';

const PINATA_API = 'https://api.pinata.cloud';

/**
 * Convert Uint8Array to base64 string (for inline storage)
 */
export function toBase64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.byteLength; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Convert base64 string back to Uint8Array
 */
export function fromBase64(base64: string): Uint8Array {
  // Restore standard base64
  let b64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Check if data should be stored inline (in URL) vs IPFS
 */
export function shouldUseInlineStorage(data: Uint8Array): boolean {
  return data.byteLength <= INLINE_DATA_THRESHOLD;
}

/**
 * Upload encrypted data to IPFS via Pinata (with retry)
 */
export async function uploadToIPFS(data: Uint8Array): Promise<string> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;

  if (!jwt) {
    throw new Error(
      'IPFS upload requires Pinata API key. ' +
      'Set NEXT_PUBLIC_PINATA_JWT in your environment. ' +
      'Get a free key at https://pinata.cloud',
    );
  }

  return uploadToPinata(data, jwt);
}

/**
 * Upload to Pinata
 */
async function uploadToPinata(data: Uint8Array, jwt: string): Promise<string> {
  return withRetry(
    async () => {
      const buffer = new ArrayBuffer(data.byteLength);
      new Uint8Array(buffer).set(data);

      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const formData = new FormData();
      formData.append('file', blob, 'vault.bin');

      const response = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Pinata upload failed (${response.status}): ${text}`);
      }

      const result = await response.json();
      return result.IpfsHash;
    },
    {
      maxAttempts: 3,
      onRetry: (attempt, error) => {
        console.warn(`Pinata upload retry ${attempt}:`, error.message);
      },
    },
  );
}

/**
 * Fetch data from IPFS via public gateways
 */
export async function fetchFromIPFS(cid: string): Promise<Uint8Array> {
  const gateways = [
    `${PINATA_GATEWAY}/${cid}`,
    `https://w3s.link/ipfs/${cid}`,
    `https://dweb.link/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
    `https://ipfs.io/ipfs/${cid}`,
  ];

  let lastError: Error | null = null;

  for (const url of gateways) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (error) {
      lastError = error as Error;
      console.warn(`Gateway ${url} failed:`, error);
      continue;
    }
  }

  throw new Error(`Failed to fetch from IPFS: ${lastError?.message}`);
}

