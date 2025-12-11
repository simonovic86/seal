export interface Vault {
  id: string;
  cid: string; // IPFS CID of encrypted blob
  unlockTime: number; // Unix timestamp in milliseconds
  litEncryptedKey: string; // Base64 encoded encrypted symmetric key
  litEncryptedKeyHash: string; // Hash for Lit decryption
  createdAt: number;
  name?: string;
  isFile: boolean;
  fileName?: string;
  mimeType?: string;
}

export interface DecryptedVault {
  content: string | ArrayBuffer;
  isFile: boolean;
  fileName?: string;
  mimeType?: string;
}
