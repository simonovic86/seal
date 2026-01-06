/**
 * Vault Export File (VEF) Format
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
 */

import { VaultRef } from './storage';
import { toBase64, fromBase64 } from './encoding';

// =============================================================================
// Constants
// =============================================================================

export const VEF_VERSION = '1.0.0';
export const VEF_FILE_EXTENSION = '.vef.json';

// Supported crypto configurations
const SUPPORTED_ALGORITHMS = ['AES-GCM'] as const;
const SUPPORTED_KEY_LENGTHS = [256] as const;
const SUPPORTED_IV_LENGTHS = [12] as const;

// Supported Lit configurations
const SUPPORTED_LIT_CHAINS = ['ethereum'] as const;
const SUPPORTED_LIT_NETWORKS = ['datil-dev', 'datil'] as const;

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
 * Lit Protocol access control condition (fully expanded, no references)
 */
export interface VEFLitCondition {
  conditionType: 'evmBasic';
  contractAddress: string;
  standardContractType: 'timestamp';
  chain: 'ethereum';
  method: string;
  parameters: string[];
  returnValueTest: {
    comparator: '>=' | '<=' | '>' | '<' | '==' | '!=';
    value: string;
  };
}

/**
 * Lit Protocol configuration
 */
export interface VEFLit {
  network: 'datil-dev' | 'datil';
  chain: 'ethereum';
  conditions: VEFLitCondition[];
  encrypted_key: string;
  encrypted_key_hash: string;
}

/**
 * Lit validation snapshot for debugging/verification
 */
export interface VEFLitValidation {
  chain: 'ethereum';
  sdk_version: string;
  network: 'datil-dev' | 'datil';
}

/**
 * The complete Vault Export File format
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

  // Lit Protocol configuration
  lit: VEFLit;

  // Timestamps
  unlock_timestamp: number; // Unix ms when vault becomes unlockable
  created_at: number; // Unix ms when vault was created

  // App metadata
  app_version: string;

  // Lit validation snapshot
  lit_validation: VEFLitValidation;

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
 * - lit conditions (serialized)
 * - lit encrypted_key_hash
 */
export async function generateVaultId(
  encryptedPayload: string,
  unlockTimestamp: number,
  litConditions: VEFLitCondition[],
  litEncryptedKeyHash: string,
): Promise<string> {
  const content = JSON.stringify({
    p: encryptedPayload,
    t: unlockTimestamp,
    c: litConditions,
    h: litEncryptedKeyHash,
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

/**
 * Build Lit conditions from unlock timestamp
 */
function buildLitConditions(unlockTimestamp: number): VEFLitCondition[] {
  const unlockTimeSeconds = Math.floor(unlockTimestamp / 1000);
  return [
    {
      conditionType: 'evmBasic',
      contractAddress: '',
      standardContractType: 'timestamp',
      chain: 'ethereum',
      method: '',
      parameters: [],
      returnValueTest: {
        comparator: '>=',
        value: unlockTimeSeconds.toString(),
      },
    },
  ];
}

// =============================================================================
// Export Function
// =============================================================================

/**
 * Validate vault has required fields for export
 */
export function validateVaultForExport(vault: VaultRef): string | null {
  if (!vault.inlineData) {
    return 'Vault missing encrypted data (inlineData)';
  }
  if (!vault.litEncryptedKey) {
    return 'Vault missing Lit encrypted key';
  }
  if (!vault.litKeyHash) {
    return 'Vault missing Lit key hash';
  }
  if (!vault.unlockTime || vault.unlockTime <= 0) {
    return 'Vault missing unlock time';
  }
  return null;
}

/**
 * Export a vault to VEF format.
 *
 * @param vault - The vault reference to export
 * @param appVersion - Current app version
 * @param litSdkVersion - Lit SDK version used
 * @returns VaultExportFile object
 * @throws Error if vault is missing required fields
 */
export async function exportVault(
  vault: VaultRef,
  appVersion: string = '0.2.0',
  litSdkVersion: string = '7.3.1',
): Promise<VaultExportFile> {
  // Validate vault has required fields
  const validationError = validateVaultForExport(vault);
  if (validationError) {
    throw new Error(validationError);
  }

  const conditions = buildLitConditions(vault.unlockTime);

  // Generate deterministic vault_id
  const vaultId = await generateVaultId(
    vault.inlineData,
    vault.unlockTime,
    conditions,
    vault.litKeyHash,
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
    lit: {
      network: 'datil-dev',
      chain: 'ethereum',
      conditions,
      encrypted_key: vault.litEncryptedKey,
      encrypted_key_hash: vault.litKeyHash,
    },
    unlock_timestamp: vault.unlockTime,
    created_at: vault.createdAt || Date.now(),
    app_version: appVersion,
    lit_validation: {
      chain: 'ethereum',
      sdk_version: litSdkVersion,
      network: 'datil-dev',
    },
  };

  if (vault.name) {
    vef.name = vault.name;
  }

  if (vault.destroyAfterRead) {
    vef.destroy_after_read = true;
  }

  return vef;
}

/**
 * Export vault to JSON string (formatted for readability)
 */
export async function exportVaultToJson(
  vault: VaultRef,
  appVersion?: string,
  litSdkVersion?: string,
): Promise<string> {
  const vef = await exportVault(vault, appVersion, litSdkVersion);
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

  // vault_id
  if (typeof vef.vault_id !== 'string' || vef.vault_id.length < 8) {
    return { valid: false, error: 'Invalid vault_id', field: 'vault_id' };
  }

  // encrypted_payload
  if (typeof vef.encrypted_payload !== 'string' || vef.encrypted_payload.length === 0) {
    return { valid: false, error: 'Missing encrypted_payload', field: 'encrypted_payload' };
  }

  // crypto
  const cryptoResult = validateCrypto(vef.crypto);
  if (!cryptoResult.valid) return cryptoResult;

  // lit
  const litResult = validateLit(vef.lit);
  if (!litResult.valid) return litResult;

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

  // lit_validation
  const litValidationResult = validateLitValidation(vef.lit_validation);
  if (!litValidationResult.valid) return litValidationResult;

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

  if (!SUPPORTED_ALGORITHMS.includes(c.algorithm as typeof SUPPORTED_ALGORITHMS[number])) {
    return {
      valid: false,
      error: `Unsupported algorithm: ${c.algorithm}. Supported: ${SUPPORTED_ALGORITHMS.join(', ')}`,
      field: 'crypto.algorithm',
    };
  }

  if (!SUPPORTED_KEY_LENGTHS.includes(c.key_length as typeof SUPPORTED_KEY_LENGTHS[number])) {
    return {
      valid: false,
      error: `Unsupported key_length: ${c.key_length}`,
      field: 'crypto.key_length',
    };
  }

  if (!SUPPORTED_IV_LENGTHS.includes(c.iv_length as typeof SUPPORTED_IV_LENGTHS[number])) {
    return {
      valid: false,
      error: `Unsupported iv_length: ${c.iv_length}`,
      field: 'crypto.iv_length',
    };
  }

  return { valid: true, vef: null as unknown as VaultExportFile };
}

function validateLit(lit: unknown): VEFValidationResult {
  if (!lit || typeof lit !== 'object') {
    return { valid: false, error: 'Missing lit', field: 'lit' };
  }

  const l = lit as Record<string, unknown>;

  if (!SUPPORTED_LIT_NETWORKS.includes(l.network as typeof SUPPORTED_LIT_NETWORKS[number])) {
    return {
      valid: false,
      error: `Unsupported Lit network: ${l.network}. Supported: ${SUPPORTED_LIT_NETWORKS.join(', ')}`,
      field: 'lit.network',
    };
  }

  if (!SUPPORTED_LIT_CHAINS.includes(l.chain as typeof SUPPORTED_LIT_CHAINS[number])) {
    return {
      valid: false,
      error: `Unsupported Lit chain: ${l.chain}. Supported: ${SUPPORTED_LIT_CHAINS.join(', ')}`,
      field: 'lit.chain',
    };
  }

  if (!Array.isArray(l.conditions) || l.conditions.length === 0) {
    return { valid: false, error: 'Missing lit conditions', field: 'lit.conditions' };
  }

  if (typeof l.encrypted_key !== 'string' || l.encrypted_key.length === 0) {
    return { valid: false, error: 'Missing lit encrypted_key', field: 'lit.encrypted_key' };
  }

  if (typeof l.encrypted_key_hash !== 'string' || l.encrypted_key_hash.length === 0) {
    return { valid: false, error: 'Missing lit encrypted_key_hash', field: 'lit.encrypted_key_hash' };
  }

  return { valid: true, vef: null as unknown as VaultExportFile };
}

function validateLitValidation(litValidation: unknown): VEFValidationResult {
  if (!litValidation || typeof litValidation !== 'object') {
    return { valid: false, error: 'Missing lit_validation', field: 'lit_validation' };
  }

  const lv = litValidation as Record<string, unknown>;

  if (!SUPPORTED_LIT_CHAINS.includes(lv.chain as typeof SUPPORTED_LIT_CHAINS[number])) {
    return { valid: false, error: 'Invalid lit_validation.chain', field: 'lit_validation.chain' };
  }

  if (typeof lv.sdk_version !== 'string') {
    return { valid: false, error: 'Missing lit_validation.sdk_version', field: 'lit_validation.sdk_version' };
  }

  if (!SUPPORTED_LIT_NETWORKS.includes(lv.network as typeof SUPPORTED_LIT_NETWORKS[number])) {
    return { valid: false, error: 'Invalid lit_validation.network', field: 'lit_validation.network' };
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
    const data = JSON.parse(jsonString);
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
export async function createRestorePreview(
  vef: VaultExportFile,
  existingVaultIds: Set<string>,
): Promise<VEFRestorePreview> {
  return {
    vault_id: vef.vault_id,
    name: vef.name,
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
    litEncryptedKey: vef.lit.encrypted_key,
    litKeyHash: vef.lit.encrypted_key_hash,
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
  appVersion: string = '0.2.0',
  litSdkVersion: string = '7.3.1',
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
      const vef = await exportVault(vault, appVersion, litSdkVersion);
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
  litSdkVersion?: string,
): Promise<string> {
  const bundle = await exportBackupBundle(vaults, appVersion, litSdkVersion);
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
      vef_version: bundle.vef_version as string,
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
    const data = JSON.parse(text);

    // Check if it's a backup bundle
    if (data.bundle_type === 'backup') {
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

