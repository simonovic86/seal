/**
 * Shareable vault links
 *
 * Encodes vault data in URL hash for cross-device sharing.
 * Format: /vault/[id]#base64(json)
 *
 * v2: Uses tlock fields (c=ciphertext, r=round) instead of Lit fields (k, h)
 */

import { VaultRef } from './storage';

// Compact format to minimize URL length (v2 - tlock)
interface ShareableData {
  c: string;   // tlockCiphertext
  r: number;   // tlockRound
  t: number;   // unlockTime
  n?: string;  // name (optional)
  d: string;   // inlineData (base64 encrypted data)
  x?: boolean; // destroyAfterRead (burn after reading)
}

/**
 * Decode URL-safe base64 from hash
 */
function decodeBase64FromHash(hash: string): string | null {
  if (!hash || hash.length < 2) return null;

  // Remove leading # if present and restore standard base64
  let base64 = hash.startsWith('#') ? hash.slice(1) : hash;
  base64 = base64.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }

  return atob(base64);
}

/**
 * Decode vault data from URL hash
 */
export function decodeVaultFromHash(hash: string, id: string): VaultRef | null {
  try {
    const json = decodeBase64FromHash(hash);
    if (!json) return null;

    const data: ShareableData = JSON.parse(json);

    // Validate required fields (v2 tlock format)
    if (!data.c || !data.r || !data.t || !data.d) {
      return null;
    }

    return {
      id,
      tlockCiphertext: data.c,
      tlockRound: data.r,
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

// Compact format for backup bundle (v2 - tlock)
interface BackupVaultData extends ShareableData {
  id: string;
  a?: number; // createdAt (optional)
}

interface BackupBundle {
  v: 2; // version (v2 for tlock)
  vaults: BackupVaultData[];
}

/**
 * Validate a single vault from backup data (v2 tlock format)
 */
function isValidBackupVault(data: unknown): data is BackupVaultData {
  if (!data || typeof data !== 'object') return false;
  const v = data as Record<string, unknown>;
  return (
    typeof v.id === 'string' && v.id.length > 0 &&
    typeof v.c === 'string' && v.c.length > 0 &&
    typeof v.r === 'number' && v.r > 0 &&
    typeof v.t === 'number' && v.t > 0 &&
    typeof v.d === 'string' && v.d.length > 0
  );
}

/**
 * Decode backup bundle from URL hash
 */
export function decodeBackupFromHash(hash: string): VaultRef[] | null {
  try {
    const json = decodeBase64FromHash(hash);
    if (!json) return null;

    const bundle: BackupBundle = JSON.parse(json);

    // Validate version (v2 for tlock)
    if (bundle.v !== 2 || !Array.isArray(bundle.vaults)) {
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
        tlockCiphertext: data.c,
        tlockRound: data.r,
        unlockTime: data.t,
        createdAt: data.a || Date.now(), // Preserve original or use now
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
