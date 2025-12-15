/**
 * Lit Protocol integration for time-locked key encryption
 * 
 * Uses Lit's access control conditions to lock symmetric keys
 * until a specific timestamp is reached.
 * 
 * For "Free Mode" without user wallets, we use an ephemeral wallet
 * stored in localStorage for signing auth messages.
 * 
 * NOTE: All Lit SDK imports are lazy-loaded to reduce initial bundle size.
 * The SDK is ~1MB+ and only loaded when actually needed.
 */

import { toBase64, fromBase64 } from './crypto';
import { withRetry } from './retry';

// Types for lazy-loaded modules
type LitNodeClient = import('@lit-protocol/lit-node-client').LitNodeClient;
type EthersWallet = import('ethers').Wallet;

// Cached module references
let litNodeClient: LitNodeClient | null = null;
let cachedModules: {
  LitNodeClient?: typeof import('@lit-protocol/lit-node-client').LitNodeClient;
  encryption?: typeof import('@lit-protocol/encryption');
  authHelpers?: typeof import('@lit-protocol/auth-helpers');
  constants?: typeof import('@lit-protocol/constants');
  ethers?: typeof import('ethers');
} = {};

// Lit network - use datil-dev for testing, datil for production
const LIT_NETWORK = 'datil-dev';
const WALLET_KEY = 'lit-ephemeral-wallet';

/**
 * Lazy load Lit SDK modules
 * Only imports the heavy dependencies when actually needed
 */
async function loadLitModules() {
  if (cachedModules.LitNodeClient) return cachedModules;

  const [
    { LitNodeClient },
    encryption,
    authHelpers,
    constants,
    ethers,
  ] = await Promise.all([
    import('@lit-protocol/lit-node-client'),
    import('@lit-protocol/encryption'),
    import('@lit-protocol/auth-helpers'),
    import('@lit-protocol/constants'),
    import('ethers'),
  ]);

  cachedModules = {
    LitNodeClient,
    encryption,
    authHelpers,
    constants,
    ethers,
  };

  return cachedModules;
}

/**
 * Get or create an ephemeral wallet for Lit auth
 * This allows "Free Mode" without requiring users to connect their own wallet
 */
async function getEphemeralWallet(): Promise<EthersWallet> {
  if (typeof window === 'undefined') {
    throw new Error('Ephemeral wallet requires browser environment');
  }

  const { ethers } = await loadLitModules();
  if (!ethers) throw new Error('Failed to load ethers');

  let privateKey = localStorage.getItem(WALLET_KEY);
  if (!privateKey) {
    const wallet = ethers.Wallet.createRandom();
    privateKey = wallet.privateKey;
    localStorage.setItem(WALLET_KEY, privateKey);
  }

  return new ethers.Wallet(privateKey);
}

/**
 * Initialize the Lit Protocol client (with retry)
 * Lazy loads the Lit SDK on first call
 */
export async function initLit(): Promise<LitNodeClient> {
  if (litNodeClient) return litNodeClient;

  return withRetry(
    async () => {
      const { LitNodeClient } = await loadLitModules();
      if (!LitNodeClient) throw new Error('Failed to load LitNodeClient');

      const client = new LitNodeClient({
        litNetwork: LIT_NETWORK,
        debug: false,
      });

      await client.connect();
      litNodeClient = client;
      return client;
    },
    {
      maxAttempts: 3,
      onRetry: (attempt, error) => {
        console.warn(`Lit connection retry ${attempt}:`, error.message);
      },
    },
  );
}

/**
 * Get the current Lit client (throws if not initialized)
 */
export function getLitClient(): LitNodeClient {
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
      conditionType: 'evmBasic' as const,
      contractAddress: '',
      standardContractType: 'timestamp' as const,
      chain: 'ethereum' as const,
      method: '',
      parameters: [],
      returnValueTest: {
        comparator: '>=' as const,
        value: unlockTimeSeconds.toString(),
      },
    },
  ];
}

/**
 * Get session signatures using ephemeral wallet
 */
async function getSessionSigs() {
  const client = getLitClient();
  const { authHelpers, constants } = await loadLitModules();
  
  if (!authHelpers || !constants) {
    throw new Error('Failed to load Lit auth modules');
  }

  const wallet = await getEphemeralWallet();
  const address = await wallet.getAddress();

  const sessionSigs = await client.getSessionSigs({
    chain: 'ethereum',
    expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
    resourceAbilityRequests: [
      {
        resource: new authHelpers.LitAccessControlConditionResource('*'),
        ability: constants.LIT_ABILITY.AccessControlConditionDecryption,
      },
    ],
    authNeededCallback: async ({ uri, expiration, resourceAbilityRequests }) => {
      const toSign = await authHelpers.createSiweMessage({
        uri: uri!,
        expiration: expiration!,
        resources: resourceAbilityRequests!,
        walletAddress: address,
        nonce: await client.getLatestBlockhash(),
        litNodeClient: client,
      });

      return await authHelpers.generateAuthSig({
        signer: wallet,
        toSign,
      });
    },
  });

  return sessionSigs;
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
  const { encryption } = await loadLitModules();
  
  if (!encryption) {
    throw new Error('Failed to load Lit encryption module');
  }

  const accessControlConditions = createTimeCondition(unlockTime);

  // Convert key to string for encryption
  const keyString = toBase64(symmetricKey);

  const { ciphertext, dataToEncryptHash } = await encryption.encryptString(
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
 * Decrypt the symmetric key after the unlock time has passed (with retry)
 */
export async function decryptKey(
  encryptedKey: string,
  encryptedKeyHash: string,
  unlockTime: number,
): Promise<Uint8Array> {
  return withRetry(
    async () => {
      const client = getLitClient();
      const { encryption } = await loadLitModules();
      
      if (!encryption) {
        throw new Error('Failed to load Lit encryption module');
      }

      const accessControlConditions = createTimeCondition(unlockTime);

      // Get session signatures using ephemeral wallet
      const sessionSigs = await getSessionSigs();

      const decryptedString = await encryption.decryptToString(
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
    },
    {
      maxAttempts: 2,
      onRetry: (attempt, error) => {
        console.warn(`Lit decryption retry ${attempt}:`, error.message);
      },
    },
  );
}

/**
 * Check if the current time is past the unlock time
 * This is a pure function with no dependencies - always fast
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
