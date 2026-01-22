/**
 * Local storage for vault references using idb-keyval
 * Stores vault metadata so user can find their vaults later
 */

import { get, set, del, keys } from 'idb-keyval';

export interface VaultRef {
  id: string;
  unlockTime: number;
  tlockCiphertext: string;  // tlock-encrypted symmetric key
  tlockRound: number;       // drand round number for decryption
  createdAt: number;
  name?: string;
  inlineData: string;  // Base64 encrypted data stored in URL
  destroyAfterRead?: boolean;
}

const VAULT_PREFIX = 'vault:';

/**
 * Save vault reference locally
 */
export async function saveVaultRef(vault: VaultRef): Promise<void> {
  await set(`${VAULT_PREFIX}${vault.id}`, vault);
}

/**
 * Get vault reference by ID
 */
export async function getVaultRef(id: string): Promise<VaultRef | undefined> {
  return get(`${VAULT_PREFIX}${id}`);
}

/**
 * Delete vault reference
 */
export async function deleteVaultRef(id: string): Promise<void> {
  await del(`${VAULT_PREFIX}${id}`);
}

/**
 * Forget a vault locally.
 * 
 * Removes the vault's metadata from this browser's local storage.
 * This is local hygiene only — it does NOT:
 * - Invalidate URLs
 * - Affect encrypted payloads
 * - Delete data from IPFS
 * - Impact backups or other devices
 * 
 * Idempotent: safe to call multiple times.
 */
export async function forgetVault(id: string): Promise<void> {
  await del(`${VAULT_PREFIX}${id}`);
}

/**
 * Get all saved vault references
 */
export async function getAllVaultRefs(): Promise<VaultRef[]> {
  const allKeys = await keys();
  const vaultKeys = allKeys.filter(
    (key) => typeof key === 'string' && key.startsWith(VAULT_PREFIX),
  );

  const vaults: VaultRef[] = [];
  for (const key of vaultKeys) {
    const vault = await get<VaultRef>(key);
    if (vault) {
      vaults.push(vault);
    }
  }

  return vaults.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get all vault IDs as a Set (for fast lookup)
 */
export async function getAllVaultIds(): Promise<Set<string>> {
  const vaults = await getAllVaultRefs();
  return new Set(vaults.map((v) => v.id));
}

