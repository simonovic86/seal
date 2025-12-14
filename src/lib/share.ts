/**
 * Shareable vault links
 * 
 * Encodes vault data in URL hash for cross-device sharing.
 * Format: /vault/[id]#base64(json)
 */

import { VaultRef } from './storage';

// Compact format to minimize URL length
interface ShareableData {
  c: string;  // cid (empty string if using inline data)
  k: string;  // litEncryptedKey
  h: string;  // litKeyHash
  t: number;  // unlockTime
  n?: string; // name (optional)
  d?: string; // inlineData (base64 encrypted data, for small vaults)
}

/**
 * Encode vault data for URL hash
 * Supports both IPFS (CID) and inline data modes
 */
export function encodeVaultForShare(vault: VaultRef): string {
  const data: ShareableData = {
    c: vault.cid,
    k: vault.litEncryptedKey,
    h: vault.litKeyHash,
    t: vault.unlockTime,
  };

  if (vault.name) {
    data.n = vault.name;
  }

  // Include inline data if present (for small vaults with no IPFS)
  if (vault.inlineData) {
    data.d = vault.inlineData;
  }

  // Use URL-safe base64
  const json = JSON.stringify(data);
  const base64 = btoa(json)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return base64;
}

/**
 * Decode vault data from URL hash
 */
export function decodeVaultFromHash(hash: string, id: string): VaultRef | null {
  try {
    if (!hash || hash.length < 2) return null;

    // Remove leading # if present
    let base64 = hash.startsWith('#') ? hash.slice(1) : hash;

    // Restore URL-safe base64 to standard
    base64 = base64
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }

    const json = atob(base64);
    const data: ShareableData = JSON.parse(json);

    // Validate required fields (cid can be empty if inline data is present)
    if (!data.k || !data.h || !data.t) {
      return null;
    }

    // Must have either CID or inline data
    if (!data.c && !data.d) {
      return null;
    }

    return {
      id,
      cid: data.c || '',
      litEncryptedKey: data.k,
      litKeyHash: data.h,
      unlockTime: data.t,
      createdAt: 0, // Unknown for shared vaults
      name: data.n,
      inlineData: data.d,
    };
  } catch (error) {
    console.error('Failed to decode vault from hash:', error);
    return null;
  }
}

/**
 * Get full shareable URL for a vault
 */
export function getShareableUrl(vault: VaultRef): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const hash = encodeVaultForShare(vault);
  return `${base}/vault/${vault.id}#${hash}`;
}

/**
 * Check if current URL has vault data in hash
 */
export function hasVaultDataInHash(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  return hash.length > 10; // Minimum reasonable length for encoded data
}

// Compact format for backup bundle
interface BackupBundle {
  v: 1; // version
  vaults: Array<ShareableData & { id: string; d?: string }>;
}

/**
 * Encode all vaults into a backup URL
 */
export function encodeBackupUrl(vaults: VaultRef[]): string {
  const bundle: BackupBundle = {
    v: 1,
    vaults: vaults.map((vault) => ({
      id: vault.id,
      c: vault.cid,
      k: vault.litEncryptedKey,
      h: vault.litKeyHash,
      t: vault.unlockTime,
      n: vault.name,
      d: vault.inlineData,
    })),
  };

  const json = JSON.stringify(bundle);
  const base64 = btoa(json)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/restore#${base64}`;
}

/**
 * Decode backup bundle from URL hash
 */
export function decodeBackupFromHash(hash: string): VaultRef[] | null {
  try {
    if (!hash || hash.length < 2) return null;

    // Remove leading # if present
    let base64 = hash.startsWith('#') ? hash.slice(1) : hash;

    // Restore URL-safe base64 to standard
    base64 = base64
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }

    const json = atob(base64);
    const bundle: BackupBundle = JSON.parse(json);

    // Validate version
    if (bundle.v !== 1 || !Array.isArray(bundle.vaults)) {
      return null;
    }

    return bundle.vaults.map((data) => ({
      id: data.id,
      cid: data.c || '',
      litEncryptedKey: data.k,
      litKeyHash: data.h,
      unlockTime: data.t,
      createdAt: Date.now(), // Set to now when restoring
      name: data.n,
      inlineData: data.d,
    }));
  } catch (error) {
    console.error('Failed to decode backup:', error);
    return null;
  }
}

