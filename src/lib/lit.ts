/**
 * Lit Protocol integration for time-locked key encryption
 * 
 * Uses Lit's access control conditions to lock symmetric keys
 * until a specific timestamp is reached.
 */

import * as LitJsSdk from '@lit-protocol/lit-node-client';
import { toBase64, fromBase64 } from './crypto';

let litNodeClient: LitJsSdk.LitNodeClient | null = null;

// Lit network to use
const LIT_NETWORK = 'datil-dev'; // Use 'datil' for production

/**
 * Initialize the Lit Protocol client
 */
export async function initLit(): Promise<LitJsSdk.LitNodeClient> {
  if (litNodeClient) return litNodeClient;

  litNodeClient = new LitJsSdk.LitNodeClient({
    litNetwork: LIT_NETWORK,
    debug: false,
  });

  await litNodeClient.connect();
  return litNodeClient;
}

/**
 * Get the current Lit client (throws if not initialized)
 */
export function getLitClient(): LitJsSdk.LitNodeClient {
  if (!litNodeClient) {
    throw new Error('Lit client not initialized. Call initLit() first.');
  }
  return litNodeClient;
}

/**
 * Create time-based access control conditions
 * Key can only be retrieved after the specified timestamp
 */
function createTimeCondition(unlockTime: number) {
  // Convert to seconds for blockchain timestamp
  const unlockTimeSeconds = Math.floor(unlockTime / 1000);

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

/**
 * Encrypt a symmetric key with time-based access control
 * Returns the encrypted key that can only be decrypted after unlockTime
 */
export async function encryptKeyWithTimelock(
  symmetricKey: Uint8Array,
  unlockTime: number,
): Promise<{ encryptedKey: string; encryptedKeyHash: string }> {
  const client = getLitClient();
  const accessControlConditions = createTimeCondition(unlockTime);

  // Convert key to string for encryption
  const keyString = toBase64(symmetricKey);

  const { ciphertext, dataToEncryptHash } = await LitJsSdk.encryptString(
    {
      accessControlConditions,
      dataToEncrypt: keyString,
    },
    client,
  );

  return {
    encryptedKey: ciphertext,
    encryptedKeyHash: dataToEncryptHash,
  };
}

/**
 * Decrypt the symmetric key after the unlock time has passed
 * Requires user to sign a message for authentication
 */
export async function decryptKey(
  encryptedKey: string,
  encryptedKeyHash: string,
  unlockTime: number,
): Promise<Uint8Array> {
  const client = getLitClient();
  const accessControlConditions = createTimeCondition(unlockTime);

  // Get session signatures using wallet signature
  const sessionSigs = await client.getSessionSigs({
    chain: 'ethereum',
    expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 min
    resourceAbilityRequests: [
      {
        resource: new LitJsSdk.LitAccessControlConditionResource('*'),
        ability: LitJsSdk.LitAbility.AccessControlConditionDecryption,
      },
    ],
  });

  const decryptedString = await LitJsSdk.decryptToString(
    {
      accessControlConditions,
      ciphertext: encryptedKey,
      dataToEncryptHash: encryptedKeyHash,
      sessionSigs,
      chain: 'ethereum',
    },
    client,
  );

  return fromBase64(decryptedString);
}

/**
 * Check if the current time is past the unlock time
 */
export function isUnlockable(unlockTime: number): boolean {
  return Date.now() >= unlockTime;
}

/**
 * Disconnect from Lit network
 */
export async function disconnectLit(): Promise<void> {
  if (litNodeClient) {
    await litNodeClient.disconnect();
    litNodeClient = null;
  }
}

