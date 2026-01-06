/**
 * Shareable vault links
 * 
 * Encodes vault data in URL hash for cross-device sharing.
 * Format: /vault/[id]#base64(json)
 */

import { VaultRef } from './storage';

// Compact format to minimize URL length
interface ShareableData {
  k: string;  // litEncryptedKey
  h: string;  // litKeyHash
  t: number;  // unlockTime
  n?: string; // name (optional)
  d: string;  // inlineData (base64 encrypted data)
  x?: boolean; // destroyAfterRead (burn after reading)
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

    // Validate required fields
    if (!data.k || !data.h || !data.t || !data.d) {
      return null;
    }

    return {
      id,
      litEncryptedKey: data.k,
      litKeyHash: data.h,
      unlockTime: data.t,
      createdAt: 0, // Unknown for shared vaults
      name: data.n,
      inlineData: data.d,
      destroyAfterRead: data.x,
    };
  } catch (error) {
    console.error('Failed to decode vault from hash:', error);
    return null;
  }
}

// Compact format for backup bundle
interface BackupVaultData extends ShareableData {
  id: string;
  c?: number; // createdAt (optional for backwards compat)
}

interface BackupBundle {
  v: 1; // version
  vaults: BackupVaultData[];
}

/**
 * Validate a single vault from backup data
 */
function isValidBackupVault(data: unknown): data is BackupVaultData {
  if (!data || typeof data !== 'object') return false;
  const v = data as Record<string, unknown>;
  return (
    typeof v.id === 'string' && v.id.length > 0 &&
    typeof v.k === 'string' && v.k.length > 0 &&
    typeof v.h === 'string' && v.h.length > 0 &&
    typeof v.t === 'number' && v.t > 0 &&
    typeof v.d === 'string' && v.d.length > 0
  );
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

    // Validate and convert each vault
    const vaults: VaultRef[] = [];
    for (const data of bundle.vaults) {
      if (!isValidBackupVault(data)) {
        console.warn('Skipping invalid vault in backup:', data);
        continue;
      }
      vaults.push({
        id: data.id,
        litEncryptedKey: data.k,
        litKeyHash: data.h,
        unlockTime: data.t,
        createdAt: data.c || Date.now(), // Preserve original or use now
        name: data.n,
        inlineData: data.d,
        destroyAfterRead: data.x,
      });
    }

    return vaults.length > 0 ? vaults : null;
  } catch (error) {
    console.error('Failed to decode backup:', error);
    return null;
  }
}
