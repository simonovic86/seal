/**
 * Vault Export File (VEF) Format v2.0
 *
 * A portable, deterministic JSON format for vault backup and restore.
 * Contains only encrypted data and metadata - no secrets, no plaintext, no keys.
 *
 * VEF is designed to be:
 * - Explicit: User-triggered, no auto-sync
 * - Debuggable: Human-readable JSON
 * - Idempotent: Same vault → same vault_id, no duplicates on restore
 * - Forward-compatible: Versioned schema
 * - Safe: Partial restore fails explicitly
 *
 * v2.0 uses drand/tlock for timelock encryption (replaces Lit Protocol from v1.0)
 */

import { VaultRef } from './storage';
import { resolveVaultNameForCreatedAt } from './vaultName';
import { DRAND_CHAIN_HASH } from './tlock';

// =============================================================================
// Constants
// =============================================================================

export const VEF_VERSION = '2.0.0';
export const VEF_FILE_EXTENSION = '.vef.json';

// Supported crypto configurations
const SUPPORTED_ALGORITHMS = ['AES-GCM'] as const;
const SUPPORTED_KEY_LENGTHS = [256] as const;
const SUPPORTED_IV_LENGTHS = [12] as const;

// Supported drand chain hashes
const SUPPORTED_CHAIN_HASHES = [
  '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971', // quicknet (mainnet)
] as const;

// =============================================================================
// VEF Schema Types
// =============================================================================

/**
 * Crypto parameters for the encrypted payload
 */
export interface VEFCrypto {
  algorithm: 'AES-GCM';
  key_length: 256;
  iv_length: 12;
}

/**
 * tlock (drand timelock) configuration
 */
export interface VEFTlock {
  chain_hash: string; // drand chain identifier
  round: number; // target round number
  ciphertext: string; // tlock-encrypted symmetric key
}

/**
 * The complete Vault Export File format (v2.0)
 */
export interface VaultExportFile {
  // Schema version
  vef_version: string;

  // Deterministic vault identifier (hash of content)
  vault_id: string;

  // The encrypted payload (base64)
  encrypted_payload: string;

  // Crypto parameters
  crypto: VEFCrypto;

  // tlock configuration (replaces lit from v1.0)
  tlock: VEFTlock;

  // Timestamps
  unlock_timestamp: number; // Unix ms when vault becomes unlockable
  created_at: number; // Unix ms when vault was created

  // App metadata
  app_version: string;

  // Optional user-defined name
  name?: string;

  // Destroy after reading flag
  destroy_after_read?: boolean;
}

// =============================================================================
// Validation Result Types
// =============================================================================

export interface VEFValidationSuccess {
  valid: true;
  vef: VaultExportFile;
}

export interface VEFValidationError {
  valid: false;
  error: string;
  field?: string;
}

export type VEFValidationResult = VEFValidationSuccess | VEFValidationError;

// =============================================================================
// Restore Preview Types
// =============================================================================

export type VaultStatus = 'locked' | 'unlockable' | 'unknown';

export interface VEFRestorePreview {
  vault_id: string;
  name?: string;
  unlock_timestamp: number;
  created_at: number;
  status: VaultStatus;
  already_exists: boolean;
  destroy_after_read: boolean;
}

// =============================================================================
// Deterministic Vault ID Generation
// =============================================================================

/**
 * Generate a deterministic vault_id from vault content.
 * Same content always produces the same ID.
 *
 * Hash inputs:
 * - encrypted_payload
 * - unlock_timestamp
 * - tlock ciphertext
 * - tlock round
 */
export async function generateVaultId(
  encryptedPayload: string,
  unlockTimestamp: number,
  tlockCiphertext: string,
  tlockRound: number,
): Promise<string> {
  const content = JSON.stringify({
    p: encryptedPayload,
    t: unlockTimestamp,
    c: tlockCiphertext,
    r: tlockRound,
  });

  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  // Return first 16 bytes as hex (32 chars)
  return Array.from(hashArray.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// =============================================================================
// Export Function
// =============================================================================

/**
 * Validate vault has required fields for export
 */
export function validateVaultForExport(vault: VaultRef): string | null {
  if (!vault.inlineData) {
    return 'Vault is incomplete (missing encrypted data)';
  }
  if (!vault.tlockCiphertext) {
    return 'Vault is incomplete (missing tlock ciphertext)';
  }
  if (!vault.tlockRound || vault.tlockRound <= 0) {
    return 'Vault is incomplete (missing tlock round)';
  }
  if (!vault.unlockTime || vault.unlockTime <= 0) {
    return 'Vault is incomplete (missing unlock time)';
  }
  return null;
}

/**
 * Export a vault to VEF format.
 *
 * @param vault - The vault reference to export
 * @param appVersion - Current app version
 * @returns VaultExportFile object
 * @throws Error if vault is missing required fields
 */
export async function exportVault(
  vault: VaultRef,
  appVersion: string = '0.3.0',
): Promise<VaultExportFile> {
  // Validate vault has required fields
  const validationError = validateVaultForExport(vault);
  if (validationError) {
    throw new Error(validationError);
  }

  // Generate deterministic vault_id
  const vaultId = await generateVaultId(
    vault.inlineData,
    vault.unlockTime,
    vault.tlockCiphertext,
    vault.tlockRound,
  );

  const vef: VaultExportFile = {
    vef_version: VEF_VERSION,
    vault_id: vaultId,
    encrypted_payload: vault.inlineData,
    crypto: {
      algorithm: 'AES-GCM',
      key_length: 256,
      iv_length: 12,
    },
    tlock: {
      chain_hash: DRAND_CHAIN_HASH,
      round: vault.tlockRound,
      ciphertext: vault.tlockCiphertext,
    },
    unlock_timestamp: vault.unlockTime,
    created_at: vault.createdAt || Date.now(),
    app_version: appVersion,
  };

  const resolvedName = resolveVaultNameForCreatedAt(vault.name, vault.createdAt);
  if (resolvedName) {
    vef.name = resolvedName;
  }

  if (vault.destroyAfterRead) {
    vef.destroy_after_read = true;
  }

  return vef;
}

/**
 * Export vault to JSON string (formatted for readability)
 */
export async function exportVaultToJson(vault: VaultRef, appVersion?: string): Promise<string> {
  const vef = await exportVault(vault, appVersion);
  return JSON.stringify(vef, null, 2);
}

/**
 * Get the suggested filename for a vault export
 */
export function getExportFilename(vaultId: string): string {
  return `vault-${vaultId}${VEF_FILE_EXTENSION}`;
}

/**
 * Trigger a file download for the VEF
 */
export async function downloadVaultExport(vault: VaultRef): Promise<void> {
  const json = await exportVaultToJson(vault);
  const vef = JSON.parse(json) as VaultExportFile;

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = getExportFilename(vef.vault_id);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate a VEF object against the schema
 */
export function validateVEF(data: unknown): VEFValidationResult {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid VEF: not an object' };
  }

  const vef = data as Record<string, unknown>;

  // Version check
  if (typeof vef.vef_version !== 'string') {
    return { valid: false, error: 'Missing vef_version', field: 'vef_version' };
  }

  // Check for v1.0 (Lit Protocol) files
  if (vef.vef_version.startsWith('1.')) {
    return {
      valid: false,
      error:
        'This vault was created with an older version (Lit Protocol). It cannot be imported into this version which uses drand/tlock.',
      field: 'vef_version',
    };
  }

  // vault_id
  if (typeof vef.vault_id !== 'string' || vef.vault_id.length < 8) {
    return { valid: false, error: 'Invalid vault_id', field: 'vault_id' };
  }

  // encrypted_payload
  if (typeof vef.encrypted_payload !== 'string' || vef.encrypted_payload.length === 0) {
    return {
      valid: false,
      error: 'Missing encrypted_payload',
      field: 'encrypted_payload',
    };
  }

  // crypto
  const cryptoResult = validateCrypto(vef.crypto);
  if (!cryptoResult.valid) {
    return cryptoResult;
  }

  // tlock
  const tlockResult = validateTlock(vef.tlock);
  if (!tlockResult.valid) {
    return tlockResult;
  }

  // unlock_timestamp
  if (typeof vef.unlock_timestamp !== 'number' || vef.unlock_timestamp <= 0) {
    return { valid: false, error: 'Invalid unlock_timestamp', field: 'unlock_timestamp' };
  }

  // created_at
  if (typeof vef.created_at !== 'number' || vef.created_at <= 0) {
    return { valid: false, error: 'Invalid created_at', field: 'created_at' };
  }

  // app_version
  if (typeof vef.app_version !== 'string') {
    return { valid: false, error: 'Missing app_version', field: 'app_version' };
  }

  // Optional fields
  if (vef.name !== undefined && typeof vef.name !== 'string') {
    return { valid: false, error: 'Invalid name', field: 'name' };
  }

  if (vef.destroy_after_read !== undefined && typeof vef.destroy_after_read !== 'boolean') {
    return { valid: false, error: 'Invalid destroy_after_read', field: 'destroy_after_read' };
  }

  return { valid: true, vef: vef as unknown as VaultExportFile };
}

function validateCrypto(crypto: unknown): VEFValidationResult {
  if (!crypto || typeof crypto !== 'object') {
    return { valid: false, error: 'Missing crypto', field: 'crypto' };
  }

  const c = crypto as Record<string, unknown>;

  if (!SUPPORTED_ALGORITHMS.includes(c.algorithm as (typeof SUPPORTED_ALGORITHMS)[number])) {
    return {
      valid: false,
      error: `Unsupported algorithm: ${String(c.algorithm)}. Supported: ${SUPPORTED_ALGORITHMS.join(', ')}`,
      field: 'crypto.algorithm',
    };
  }

  if (!SUPPORTED_KEY_LENGTHS.includes(c.key_length as (typeof SUPPORTED_KEY_LENGTHS)[number])) {
    return {
      valid: false,
      error: `Unsupported key_length: ${String(c.key_length)}`,
      field: 'crypto.key_length',
    };
  }

  if (!SUPPORTED_IV_LENGTHS.includes(c.iv_length as (typeof SUPPORTED_IV_LENGTHS)[number])) {
    return {
      valid: false,
      error: `Unsupported iv_length: ${String(c.iv_length)}`,
      field: 'crypto.iv_length',
    };
  }

  return { valid: true, vef: null as unknown as VaultExportFile };
}

function validateTlock(tlock: unknown): VEFValidationResult {
  if (!tlock || typeof tlock !== 'object') {
    return { valid: false, error: 'Missing tlock', field: 'tlock' };
  }

  const t = tlock as Record<string, unknown>;

  if (typeof t.chain_hash !== 'string' || t.chain_hash.length === 0) {
    return { valid: false, error: 'Missing tlock chain_hash', field: 'tlock.chain_hash' };
  }

  if (!SUPPORTED_CHAIN_HASHES.includes(t.chain_hash as (typeof SUPPORTED_CHAIN_HASHES)[number])) {
    return {
      valid: false,
      error: `Unsupported drand chain: ${t.chain_hash}. This vault may have been created with a different drand network.`,
      field: 'tlock.chain_hash',
    };
  }

  if (typeof t.round !== 'number' || t.round <= 0) {
    return { valid: false, error: 'Invalid tlock round', field: 'tlock.round' };
  }

  if (typeof t.ciphertext !== 'string' || t.ciphertext.length === 0) {
    return { valid: false, error: 'Missing tlock ciphertext', field: 'tlock.ciphertext' };
  }

  return { valid: true, vef: null as unknown as VaultExportFile };
}

// =============================================================================
// Restore Functions
// =============================================================================

/**
 * Parse and validate a VEF from JSON string
 */
export function parseVEF(jsonString: string): VEFValidationResult {
  try {
    const data = JSON.parse(jsonString) as unknown;
    return validateVEF(data);
  } catch (e) {
    return { valid: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
}

/**
 * Get vault status based on unlock timestamp
 */
export function getVaultStatus(unlockTimestamp: number): VaultStatus {
  const now = Date.now();
  if (now >= unlockTimestamp) {
    return 'unlockable';
  }
  return 'locked';
}

/**
 * Create a restore preview from a VEF
 */
export function createRestorePreview(
  vef: VaultExportFile,
  existingVaultIds: Set<string>,
): VEFRestorePreview {
  return {
    vault_id: vef.vault_id,
    name: resolveVaultNameForCreatedAt(vef.name, vef.created_at),
    unlock_timestamp: vef.unlock_timestamp,
    created_at: vef.created_at,
    status: getVaultStatus(vef.unlock_timestamp),
    already_exists: existingVaultIds.has(vef.vault_id),
    destroy_after_read: vef.destroy_after_read ?? false,
  };
}

/**
 * Convert a VEF back to a VaultRef for storage
 */
export function vefToVaultRef(vef: VaultExportFile): VaultRef {
  return {
    id: vef.vault_id,
    unlockTime: vef.unlock_timestamp,
    tlockCiphertext: vef.tlock.ciphertext,
    tlockRound: vef.tlock.round,
    createdAt: vef.created_at,
    name: vef.name,
    inlineData: vef.encrypted_payload,
    destroyAfterRead: vef.destroy_after_read,
  };
}

/**
 * Restore a vault from VEF (idempotent - skips if exists)
 */
export interface RestoreResult {
  success: boolean;
  vault_id: string;
  skipped: boolean;
  error?: string;
}

export async function restoreVaultFromVEF(
  vef: VaultExportFile,
  existingVaultIds: Set<string>,
  saveVault: (vault: VaultRef) => Promise<void>,
): Promise<RestoreResult> {
  // Idempotent: skip if already exists
  if (existingVaultIds.has(vef.vault_id)) {
    return {
      success: true,
      vault_id: vef.vault_id,
      skipped: true,
    };
  }

  try {
    const vaultRef = vefToVaultRef(vef);
    await saveVault(vaultRef);
    return {
      success: true,
      vault_id: vef.vault_id,
      skipped: false,
    };
  } catch (e) {
    return {
      success: false,
      vault_id: vef.vault_id,
      skipped: false,
      error: (e as Error).message,
    };
  }
}

// =============================================================================
// Backup Bundle (All Vaults)
// =============================================================================

/**
 * Backup bundle containing multiple vaults
 */
export interface VEFBackupBundle {
  vef_version: string;
  bundle_type: 'backup';
  export_timestamp: number;
  app_version: string;
  vaults: VaultExportFile[];
}

/**
 * Export all vaults as a backup bundle
 */
export async function exportBackupBundle(
  vaults: VaultRef[],
  appVersion: string = '0.3.0',
): Promise<VEFBackupBundle> {
  const vefs: VaultExportFile[] = [];
  const errors: string[] = [];

  for (const vault of vaults) {
    const validationError = validateVaultForExport(vault);
    if (validationError) {
      errors.push(`${vault.id}: ${validationError}`);
      continue;
    }

    try {
      const vef = await exportVault(vault, appVersion);
      vefs.push(vef);
    } catch (e) {
      errors.push(`${vault.id}: ${(e as Error).message}`);
    }
  }

  if (errors.length > 0) {
    console.warn('Some vaults could not be exported:', errors);
  }

  return {
    vef_version: VEF_VERSION,
    bundle_type: 'backup',
    export_timestamp: Date.now(),
    app_version: appVersion,
    vaults: vefs,
  };
}

/**
 * Export backup bundle to JSON string
 */
export async function exportBackupBundleToJson(
  vaults: VaultRef[],
  appVersion?: string,
): Promise<string> {
  const bundle = await exportBackupBundle(vaults, appVersion);
  return JSON.stringify(bundle, null, 2);
}

/**
 * Get filename for backup bundle
 */
export function getBackupFilename(): string {
  const date = new Date().toISOString().split('T')[0];
  return `lock-backup-${date}.vef.json`;
}

/**
 * Trigger download of backup bundle
 */
export async function downloadBackupBundle(vaults: VaultRef[]): Promise<number> {
  const json = await exportBackupBundleToJson(vaults);
  const bundle = JSON.parse(json) as VEFBackupBundle;

  if (bundle.vaults.length === 0) {
    throw new Error('No valid vaults to export');
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = getBackupFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return bundle.vaults.length;
}

/**
 * Validate and parse a backup bundle
 */
export type BackupBundleValidationResult =
  | { valid: true; bundle: VEFBackupBundle }
  | { valid: false; error: string };

export function parseBackupBundle(data: unknown): BackupBundleValidationResult {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid backup: not an object' };
  }

  const bundle = data as Record<string, unknown>;

  if (bundle.bundle_type !== 'backup') {
    return { valid: false, error: 'Not a backup bundle' };
  }

  if (typeof bundle.vef_version !== 'string') {
    return { valid: false, error: 'Missing vef_version' };
  }

  // Check for v1.0 bundles
  if (bundle.vef_version.startsWith('1.')) {
    return {
      valid: false,
      error:
        'This backup was created with an older version (Lit Protocol). It cannot be imported into this version which uses drand/tlock.',
    };
  }

  if (!Array.isArray(bundle.vaults)) {
    return { valid: false, error: 'Missing vaults array' };
  }

  // Validate each vault in the bundle
  const validVaults: VaultExportFile[] = [];
  const errors: string[] = [];

  for (let i = 0; i < bundle.vaults.length; i++) {
    const result = validateVEF(bundle.vaults[i]);
    if (result.valid) {
      validVaults.push(result.vef);
    } else {
      errors.push(`Vault ${i}: ${result.error}`);
    }
  }

  if (validVaults.length === 0 && errors.length > 0) {
    return { valid: false, error: `No valid vaults: ${errors.join('; ')}` };
  }

  return {
    valid: true,
    bundle: {
      vef_version: bundle.vef_version,
      bundle_type: 'backup',
      export_timestamp: bundle.export_timestamp as number,
      app_version: bundle.app_version as string,
      vaults: validVaults,
    },
  };
}

/**
 * Parse file as either single VEF or backup bundle
 */
export type ParsedVEFFile =
  | { type: 'single'; vef: VaultExportFile }
  | { type: 'bundle'; bundle: VEFBackupBundle }
  | { type: 'error'; error: string };

export async function parseVEFFile(file: File): Promise<ParsedVEFFile> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as unknown;

    // Check if it's a backup bundle
    if (
      typeof data === 'object' &&
      data !== null &&
      'bundle_type' in data &&
      data.bundle_type === 'backup'
    ) {
      const result = parseBackupBundle(data);
      if (result.valid) {
        return { type: 'bundle', bundle: result.bundle };
      }
      return { type: 'error', error: result.error };
    }

    // Try parsing as single VEF
    const result = validateVEF(data);
    if (result.valid) {
      return { type: 'single', vef: result.vef };
    }

    return { type: 'error', error: result.error };
  } catch (e) {
    return { type: 'error', error: `Failed to parse file: ${(e as Error).message}` };
  }
}

/**
 * Restore all vaults from a backup bundle
 */
export interface BundleRestoreResult {
  total: number;
  restored: number;
  skipped: number;
  errors: string[];
}

export async function restoreFromBundle(
  bundle: VEFBackupBundle,
  existingVaultIds: Set<string>,
  saveVault: (vault: VaultRef) => Promise<void>,
): Promise<BundleRestoreResult> {
  const result: BundleRestoreResult = {
    total: bundle.vaults.length,
    restored: 0,
    skipped: 0,
    errors: [],
  };

  for (const vef of bundle.vaults) {
    const restoreResult = await restoreVaultFromVEF(vef, existingVaultIds, saveVault);

    if (restoreResult.success) {
      if (restoreResult.skipped) {
        result.skipped++;
      } else {
        result.restored++;
        existingVaultIds.add(vef.vault_id); // Prevent duplicates in same batch
      }
    } else {
      result.errors.push(`${vef.vault_id}: ${restoreResult.error}`);
    }
  }

  return result;
}
