/**
 * tlock (Timelock Encryption) integration using drand
 *
 * Uses drand's distributed randomness beacon for time-locked encryption.
 * Data encrypted to a future round can only be decrypted when that round's
 * randomness is published.
 *
 * Benefits over Lit Protocol:
 * - No wallet/authentication needed
 * - Simple HTTP fetch for decryption
 * - Much smaller bundle size
 * - Fully decentralized (League of Entropy)
 */

import {
  timelockEncrypt,
  timelockDecrypt,
  mainnetClient,
  roundAt,
  Buffer,
} from 'tlock-js';
import type { HttpChainClient, ChainInfo } from 'tlock-js';

// Cached client instance
let chainClient: HttpChainClient | null = null;

// drand quicknet (mainnet) chain info - 3 second rounds
const CHAIN_INFO: ChainInfo = {
  public_key:
    '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a',
  period: 3,
  genesis_time: 1692803367,
  hash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
  groupHash: 'f477d5c89f21a17c863a7f937c6a6d15859414d2be09cd448d4279af331c5d3e',
  schemeID: 'bls-unchained-g1-rfc9380',
  metadata: {
    beaconID: 'quicknet',
  },
};

// Chain hash for export/identification
export const DRAND_CHAIN_HASH = CHAIN_INFO.hash;

/**
 * Get or create the drand chain client
 */
function getClient(): HttpChainClient {
  if (!chainClient) {
    chainClient = mainnetClient();
  }
  return chainClient;
}

/**
 * Calculate the drand round number for a given unlock time
 *
 * @param unlockTime - Unix timestamp in milliseconds
 * @returns The round number that will be available at or after unlockTime
 */
export function calculateRound(unlockTime: number): number {
  // roundAt expects milliseconds
  return roundAt(unlockTime, CHAIN_INFO);
}

/**
 * Calculate the actual unlock time for a given round
 * This is when the round's randomness becomes available
 *
 * @param round - The drand round number
 * @returns Unix timestamp in milliseconds
 */
export function roundToTime(round: number): number {
  // Round time = genesis + (round * period)
  // genesis_time is in seconds, period is in seconds
  return (CHAIN_INFO.genesis_time + round * CHAIN_INFO.period) * 1000;
}

/**
 * Encrypt a symmetric key with timelock encryption
 *
 * @param symmetricKey - The key to encrypt (Uint8Array)
 * @param unlockTime - When the key should become decryptable (Unix ms)
 * @returns Ciphertext and round number
 */
export async function encryptKeyWithTimelock(
  symmetricKey: Uint8Array,
  unlockTime: number,
): Promise<{ ciphertext: string; roundNumber: number }> {
  const client = getClient();
  const roundNumber = calculateRound(unlockTime);

  // Convert Uint8Array to Buffer for tlock-js
  const keyBuffer = Buffer.from(symmetricKey);

  // Encrypt to the target round
  const ciphertext = await timelockEncrypt(roundNumber, keyBuffer, client);

  return {
    ciphertext,
    roundNumber,
  };
}

/**
 * Decrypt the symmetric key after the unlock time has passed
 *
 * @param ciphertext - The tlock ciphertext
 * @param _roundNumber - The round number (unused, ciphertext contains it)
 * @returns The decrypted symmetric key
 */
export async function decryptKey(
  ciphertext: string,
  _roundNumber: number,
): Promise<Uint8Array> {
  const client = getClient();

  // Decrypt - this will fetch the round's randomness from drand
  const decrypted = await timelockDecrypt(ciphertext, client);

  // Convert Buffer back to Uint8Array
  return new Uint8Array(decrypted);
}

/**
 * Check if the current time is past the unlock time
 * This is a pure function with no network calls - always fast
 */
export function isUnlockable(unlockTime: number): boolean {
  return Date.now() >= unlockTime;
}

/**
 * Get information about the drand chain being used
 */
export function getChainInfo(): ChainInfo {
  return CHAIN_INFO;
}
