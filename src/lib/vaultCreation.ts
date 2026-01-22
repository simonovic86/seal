/**
 * Vault Creation - Domain Logic
 *
 * This module contains the pure domain logic for the vault commitment model.
 * No DOM, no UI, no rendering - only the business logic.
 *
 * ============================================================================
 * COMMITMENT MODEL
 * ============================================================================
 *
 * Vault creation has two explicit phases with an IRREVERSIBLE boundary:
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  PHASE 1: DRAFT                                                         │
 * │  ─────────────────                                                      │
 * │  • Encrypts plaintext with a new symmetric key                          │
 * │  • Holds encrypted payload + raw key in memory ONLY                     │
 * │  • No network calls (no drand/tlock)                                    │
 * │  • No persistence (nothing saved)                                       │
 * │  • Fully reversible - can discard at any time                          │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 *                    ╔═══════════════════════════════╗
 *                    ║   POINT OF NO RETURN          ║
 *                    ║   armDraft() called           ║
 *                    ╚═══════════════════════════════╝
 *                                    │
 *                                    ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  PHASE 2: ARMED                                                         │
 * │  ──────────────                                                         │
 * │  • Uses tlock (drand) to create time-lock on the key                   │
 * │  • Persists vault reference to storage                                  │
 * │  • IMMEDIATELY wipes all sensitive draft data                          │
 * │  • No undo, no recovery, no retry                                      │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * The boundary between Draft and Armed is the commitment point.
 * After arming, the original plaintext and raw key are unrecoverable.
 */

import { generateKey, exportKey, encrypt } from './crypto';
import { toBase64 } from './encoding';
import { encryptKeyWithTimelock } from './tlock';
import { saveVaultRef, VaultRef } from './storage';
import { resolveVaultName } from './vaultName';

// ============================================================================
// Types
// ============================================================================

/**
 * A vault draft exists ONLY in memory until armed.
 * Contains sensitive key material that MUST be wiped after arming or discard.
 */
export interface VaultDraft {
  /** When the vault becomes unlockable (Unix ms) */
  unlockTime: number;

  /** If true, vault self-destructs after first read */
  destroyAfterRead: boolean;

  /** Optional user-defined name (local metadata only) */
  name?: string;

  /**
   * SENSITIVE: The raw symmetric key used for encryption.
   * Must be zeroed after arming.
   */
  rawKey: Uint8Array;

  /**
   * SENSITIVE: The encrypted payload.
   * Must be zeroed after arming.
   */
  encryptedData: Uint8Array;

  /** Base64-encoded encrypted data for storage */
  inlineData: string;
}

/**
 * Input for creating a draft.
 */
export interface CreateDraftInput {
  /** The plaintext secret to encrypt */
  secret: string;

  /** When the vault should unlock (Unix ms) */
  unlockTime: number;

  /** Whether to destroy after first read */
  destroyAfterRead: boolean;

  /** Optional user-defined name (local metadata only) */
  name?: string;
}

// ============================================================================
// Domain Functions
// ============================================================================

/**
 * PHASE 1: Create a draft vault.
 *
 * This function:
 * - Generates a new symmetric key
 * - Encrypts the secret locally
 * - Returns a draft object held in memory
 *
 * No network calls. No persistence. Fully reversible.
 *
 * The caller is responsible for:
 * - Holding the draft in memory
 * - Either calling armDraft() or wipeDraft()
 */
export async function createDraft(input: CreateDraftInput): Promise<VaultDraft> {
  const { secret, unlockTime, destroyAfterRead, name } = input;

  // Generate key and encrypt locally - no network calls
  const key = await generateKey();
  const rawKey = await exportKey(key);
  const encryptedData = await encrypt(secret, key);
  const inlineData = toBase64(encryptedData);
  const resolvedName = resolveVaultName(name);

  return {
    unlockTime,
    destroyAfterRead,
    name: resolvedName,
    rawKey,
    encryptedData,
    inlineData,
  };
}

/**
 * PHASE 2: Arm a draft vault. IRREVERSIBLE.
 *
 * This function:
 * - Uses tlock (drand) to create a time-lock on the key
 * - Persists the vault reference to storage
 * - Returns the finalized vault reference
 *
 * After this function returns successfully:
 * - The vault exists and is time-locked
 * - The draft MUST be wiped (caller's responsibility)
 *
 * This is the POINT OF NO RETURN.
 */
export async function armDraft(draft: VaultDraft): Promise<VaultRef> {
  const resolvedName = resolveVaultName(draft.name);

  // Create time-lock with tlock (drand)
  const { ciphertext, roundNumber } = await encryptKeyWithTimelock(
    draft.rawKey,
    draft.unlockTime,
  );

  // Build vault reference
  const vault: VaultRef = {
    id: crypto.randomUUID(),
    unlockTime: draft.unlockTime,
    tlockCiphertext: ciphertext,
    tlockRound: roundNumber,
    createdAt: Date.now(),
    name: resolvedName,
    inlineData: draft.inlineData,
    destroyAfterRead: draft.destroyAfterRead,
  };

  // Persist vault - after this, the vault exists
  await saveVaultRef(vault);

  return vault;
}

/**
 * Securely wipe all sensitive data from a draft.
 *
 * This function:
 * - Zeros out the raw key bytes
 * - Zeros out the encrypted data bytes
 *
 * Call this after arming OR when discarding a draft.
 * After wiping, the draft object should be set to null.
 */
export function wipeDraft(draft: VaultDraft): void {
  // Zero out sensitive byte arrays to prevent memory recovery
  if (draft.rawKey) {
    draft.rawKey.fill(0);
  }
  if (draft.encryptedData) {
    draft.encryptedData.fill(0);
  }
}
