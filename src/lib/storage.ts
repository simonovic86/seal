/**
 * Local storage for vault references using idb-keyval
 * Stores vault metadata so user can find their vaults later
 */

import { get, set, del, keys } from 'idb-keyval';

export interface VaultRef {
  id: string;
  cid: string;           // IPFS CID (empty string if using inline data)
  unlockTime: number;
  litEncryptedKey: string;
  litKeyHash: string;
  createdAt: number;
  name?: string;
  inlineData?: string;   // Base64 encrypted data (for small vaults, no IPFS needed)
}

// Threshold for inline storage (no IPFS upload)
// Keep small to avoid URL length issues
export const INLINE_DATA_THRESHOLD = 8 * 1024; // 8KB

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

