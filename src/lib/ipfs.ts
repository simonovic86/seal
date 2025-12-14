/**
 * IPFS storage via Pinata (free tier: 1GB)
 * 
 * Setup:
 * 1. Create free account at https://pinata.cloud
 * 2. Get API key from dashboard
 * 3. Set NEXT_PUBLIC_PINATA_JWT environment variable
 */

import { withRetry } from './retry';

const PINATA_API = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

/**
 * Upload encrypted data to IPFS via Pinata (with retry)
 */
export async function uploadToIPFS(data: Uint8Array): Promise<string> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;

  if (!jwt) {
    throw new Error(
      'IPFS upload requires Pinata API key. ' +
        'Set NEXT_PUBLIC_PINATA_JWT in your environment.',
    );
  }

  return withRetry(
    async () => {
      // Create ArrayBuffer copy to avoid SharedArrayBuffer issues
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
        throw new Error(`Upload failed (${response.status}): ${text}`);
      }

      const result = await response.json();
      return result.IpfsHash;
    },
    {
      maxAttempts: 3,
      onRetry: (attempt, error) => {
        console.warn(`IPFS upload retry ${attempt}:`, error.message);
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

