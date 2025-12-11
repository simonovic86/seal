/**
 * IPFS storage using web3.storage (Storacha)
 * 
 * Auth flow:
 * 1. Create client
 * 2. Login with email (sends verification)
 * 3. User clicks email link
 * 4. Create and provision a space
 * 5. Upload files
 */

import * as Client from '@web3-storage/w3up-client';
import { StoreMemory } from '@web3-storage/w3up-client/stores/memory';

let client: Client.Client | null = null;

/**
 * Get or create the web3.storage client
 */
export async function getClient(): Promise<Client.Client> {
  if (client) return client;
  
  // Use memory store - state persists only for session
  // For production, use IndexedDB store for persistence
  const store = new StoreMemory();
  client = await Client.create({ store });
  return client;
}

/**
 * Check if user has a usable space
 */
export async function hasActiveSpace(): Promise<boolean> {
  const c = await getClient();
  const spaces = c.spaces();
  return spaces.length > 0 && c.currentSpace() !== undefined;
}

/**
 * Get auth status
 */
export async function getAuthStatus(): Promise<{
  hasAgent: boolean;
  hasSpace: boolean;
  currentSpace: string | null;
}> {
  const c = await getClient();
  const spaces = c.spaces();
  const current = c.currentSpace();
  
  return {
    hasAgent: c.agent !== undefined,
    hasSpace: spaces.length > 0,
    currentSpace: current?.did() || null,
  };
}

/**
 * Login with email - returns when verification is complete
 * User must click the email link for this to resolve
 */
export async function loginWithEmail(email: string): Promise<void> {
  const c = await getClient();
  
  // This sends email and waits for user to click verification link
  const account = await c.login(email as `${string}@${string}`);
  
  // After login, check for existing spaces or create one
  const spaces = c.spaces();
  
  if (spaces.length === 0) {
    // Create a new space
    const space = await c.createSpace('time-vault', { account });
    
    // Provision the space with the account's payment plan
    await c.setCurrentSpace(space.did());
  } else {
    // Use existing space
    await c.setCurrentSpace(spaces[0].did());
  }
}

/**
 * Upload encrypted data to IPFS
 * Returns the CID
 */
export async function uploadEncryptedBlob(data: Uint8Array): Promise<string> {
  const c = await getClient();
  
  if (!c.currentSpace()) {
    throw new Error('No space selected. Please authenticate first.');
  }

  // Create a fresh ArrayBuffer to avoid SharedArrayBuffer type issues
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);

  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const file = new File([blob], 'encrypted.bin', {
    type: 'application/octet-stream',
  });

  const cid = await c.uploadFile(file);
  return cid.toString();
}

/**
 * Fetch encrypted data from IPFS via public gateway
 */
export async function fetchBlob(cid: string): Promise<Uint8Array> {
  // Use multiple gateways for reliability
  const gateways = [
    `https://w3s.link/ipfs/${cid}`,
    `https://dweb.link/ipfs/${cid}`,
    `https://${cid}.ipfs.w3s.link`,
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
      console.warn(`Failed to fetch from ${url}:`, error);
      continue;
    }
  }

  throw new Error(`Failed to fetch from IPFS: ${lastError?.message}`);
}
