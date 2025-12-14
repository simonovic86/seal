# Time-Locked Vault

A fully decentralized app to lock secrets until a specific time. No accounts, no servers, no trust required.

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Secret    │────▶│  Encrypted  │────▶│    IPFS     │
│  (client)   │     │  AES-256    │     │  (Pinata)   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Lit Protocol│
                    │ Time-Lock   │
                    └─────────────┘
```

1. **Encrypt** - Your secret is encrypted client-side with AES-256-GCM
2. **Store** - Encrypted blob uploaded to IPFS (via Pinata)
3. **Time-Lock** - Decryption key locked by Lit Protocol until unlock time
4. **Decrypt** - After time passes, key is released and secret decrypted locally

**No one can access your secret before the unlock time** - not even us, because:
- We never see your plaintext secret
- We never hold your decryption key
- Time-lock is enforced by Lit Protocol's decentralized network

## Features

- **Text secrets** - Lock any message
- **Time presets** - 1 hour, 24 hours, 7 days, 30 days, or custom
- **Shareable links** - Links work on any device (vault data encoded in URL)
- **Backup/Restore** - Export all vaults to a single link, restore on any browser
- **Verify on IPFS** - View your encrypted data on the public IPFS network
- **No accounts** - Just create and share

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 15 + TypeScript + Tailwind CSS |
| Encryption | Web Crypto API (AES-256-GCM) |
| Storage | IPFS via Pinata |
| Time-Lock | Lit Protocol (datil-dev network) |
| Local Data | IndexedDB (idb-keyval) |

## Setup

### Prerequisites

- Node.js 18+
- Free [Pinata](https://pinata.cloud) account

### Installation

```bash
# Clone the repo
git clone <repo-url>
cd lock

# Install dependencies
npm install

# Configure Pinata
cp .env.example .env.local
# Edit .env.local and add your Pinata JWT token
```

### Get Pinata JWT

1. Create free account at [pinata.cloud](https://pinata.cloud)
2. Go to API Keys in dashboard
3. Create new key with "pinFileToIPFS" permission
4. Copy the JWT token to `.env.local`:

```env
NEXT_PUBLIC_PINATA_JWT=your_jwt_token_here
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

### Create a Vault

1. Enter your secret message
2. Select unlock time (or use Custom for specific date/time)
3. Click "Lock Secret"
4. Copy the shareable link

### Unlock a Vault

1. Open the vault link
2. Wait for countdown (if still locked)
3. Click "Unlock Vault"
4. View your decrypted secret

### Backup Your Vaults

1. Click "Backup" button on home page
2. Save the copied link somewhere safe
3. On a new browser, paste the link to restore all vaults

### Verify on IPFS

Click "View on IPFS" to see your encrypted data exists on the public IPFS network via the [IPLD Explorer](https://explore.ipld.io).

## Architecture

```
src/
├── app/
│   ├── page.tsx          # Home - create vault + vault list
│   ├── vault/[id]/       # View/unlock individual vault
│   └── restore/          # Restore vaults from backup link
├── components/
│   ├── CreateVaultForm   # Main form for creating vaults
│   ├── TimeSelector      # Time picker component
│   ├── VaultCountdown    # Countdown timer display
│   └── Toast             # Notification component
└── lib/
    ├── crypto.ts         # AES-256-GCM encryption
    ├── ipfs.ts           # Pinata IPFS upload/fetch
    ├── lit.ts            # Lit Protocol time-lock
    ├── storage.ts        # IndexedDB vault storage
    ├── share.ts          # URL encoding for sharing
    ├── retry.ts          # Retry logic for network calls
    └── errors.ts         # User-friendly error messages
```

## Security

### What's encrypted?
- Your secret is encrypted with a random AES-256-GCM key
- The key is then encrypted by Lit Protocol with time-based access control

### What's stored where?

| Data | Location | Visibility |
|------|----------|------------|
| Encrypted secret | IPFS (public) | Anyone can see the encrypted blob |
| Decryption key | Lit Protocol | Only released after unlock time |
| Vault metadata | Your browser (IndexedDB) | Only on your device |
| Shareable link | URL hash | Anyone with the link |

### What we DON'T have access to:
- Your plaintext secret
- Your decryption key
- Your vault list (stored locally)

### Trust assumptions:
- **Lit Protocol** - Decentralized network enforces time-lock honestly
- **IPFS/Pinata** - Data remains available (pinned by Pinata)
- **Your browser** - Crypto operations are secure

## Limitations

- **Max secret size** - Limited by IPFS upload (~10MB on free Pinata tier)
- **Time accuracy** - Depends on blockchain timestamp (±minutes)
- **Data persistence** - Relies on Pinata pinning; unpinned data may disappear
- **Network required** - Need internet to create/unlock vaults

## Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

## License

MIT

---

**No accounts. No servers. Your data lives on IPFS, time-locked by Lit Protocol. We keep nothing.**
