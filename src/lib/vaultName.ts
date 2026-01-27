/**
 * Vault naming helpers (local metadata only).
 *
 * Names are deterministic and derived from the local date.
 * They never affect cryptographic semantics.
 */

function generateVaultName(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `Vault – ${year}-${month}-${day}`;
}

export function resolveVaultName(name?: string, date: Date = new Date()): string {
  const trimmed = name?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : generateVaultName(date);
}

export function resolveVaultNameForCreatedAt(name?: string, createdAt?: number): string {
  const date = createdAt && createdAt > 0 ? new Date(createdAt) : new Date();
  return resolveVaultName(name, date);
}
