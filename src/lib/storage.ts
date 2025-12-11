/**
 * IndexedDB storage for vault metadata using idb-keyval
 */

import { get, set, del, keys } from 'idb-keyval';
import type { Vault } from '@/types/vault';

const VAULT_PREFIX = 'vault:';

/**
 * Save vault metadata to IndexedDB
 */
export async function saveVault(vault: Vault): Promise<void> {
  await set(`${VAULT_PREFIX}${vault.id}`, vault);
}

/**
 * Get vault by ID
 */
export async function getVault(id: string): Promise<Vault | undefined> {
  return get(`${VAULT_PREFIX}${id}`);
}

/**
 * Delete vault by ID
 */
export async function deleteVault(id: string): Promise<void> {
  await del(`${VAULT_PREFIX}${id}`);
}

/**
 * Get all vaults
 */
export async function getAllVaults(): Promise<Vault[]> {
  const allKeys = await keys();
  const vaultKeys = allKeys.filter(
    (key) => typeof key === 'string' && key.startsWith(VAULT_PREFIX),
  );

  const vaults: Vault[] = [];
  for (const key of vaultKeys) {
    const vault = await get<Vault>(key);
    if (vault) {
      vaults.push(vault);
    }
  }

  // Sort by creation time, newest first
  return vaults.sort((a, b) => b.createdAt - a.createdAt);
}
