# Seal

**Cryptographic time-locked encryption for the browser**

Seal is a client-side web application that enables users to create encrypted vaults that remain inaccessible until a predetermined time. Built on drand's distributed randomness beacon and AES-GCM encryption, Seal provides provable time-lock guarantees without trusted third parties.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Overview

Seal implements time-locked encryption using the [drand network](https://drand.love), allowing users to create cryptographic vaults that:

- **Cannot be opened early** — not by the creator, not by anyone
- **Automatically unlock** — when the specified time arrives
- **Require no trusted parties** — leverages decentralized randomness
- **Work entirely client-side** — no backend, no accounts, no tracking

### Use Cases

- **Dead man's switches** — Release information if you don't check in
- **Delayed disclosures** — Share secrets with a time delay
- **Future messages** — Send time-locked notes to yourself or others
- **Trustless escrow** — Create verifiable time-locked commitments

---

## How It Works

### Cryptographic Architecture

1. **Content Encryption**
   - User content is encrypted with AES-256-GCM using a randomly generated symmetric key
   - The plaintext is immediately discarded after encryption

2. **Time-Lock Implementation**
   - The symmetric key is encrypted using [tlock](https://github.com/drand/tlock) (timelock encryption)
   - Decryption requires randomness from a specific future drand round
   - The drand network publishes verifiable randomness every 3 seconds

3. **Decentralized Verification**
   - Drand operates as a distributed randomness beacon maintained by the [League of Entropy](https://leagueofentropy.com/)
   - No single party can predict or manipulate future randomness
   - Guarantees are cryptographic, not trust-based

### Vault Lifecycle

```
┌─────────────┐
│   CREATE    │  1. Enter content and unlock time
│   (Draft)   │  2. Local encryption with random key
└──────┬──────┘
       │
       ▼
┌─────────────┐
│     ARM     │  3. Timelock key with drand round
│ (Committed) │  4. Generate shareable URL
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   LOCKED    │  5. Countdown to unlock time
│  (Waiting)  │     Content cryptographically inaccessible
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  UNLOCKED   │  6. Fetch drand randomness
│ (Available) │  7. Decrypt and display content
└─────────────┘
```

---

## Features

### Core Functionality

- **Time-locked vaults** — Set unlock time from minutes to years in the future
- **Client-side encryption** — All cryptographic operations happen in your browser
- **Shareable URLs** — Vaults encoded as compact, shareable links
- **Burn after reading** — Optional self-destruct after first unlock
- **Backup & restore** — Export/import vault collections as JSON

### Security Properties

- ✅ **No early access** — Cryptographically impossible to decrypt before unlock time
- ✅ **No trusted parties** — Relies on decentralized drand network
- ✅ **Forward secrecy** — Past randomness cannot be used to predict future rounds
- ✅ **Open source** — All code is auditable and publicly available

### Technical Stack

- **Frontend**: TypeScript, Vite
- **Encryption**: Web Crypto API (AES-256-GCM)
- **Time-lock**: [tlock-js](https://github.com/drand/tlock-js) (drand quicknet)
- **Storage**: IndexedDB (via idb-keyval)
- **PWA**: Installable on iOS/Android

---

## Usage

### Creating a Vault

1. Navigate to the application
2. Enter your content in the text area
3. Select the unlock date and time
4. Click "Prepare Vault" to review
5. Click "Arm Vault" to finalize (irreversible)
6. Share the generated URL

### Opening a Vault

1. Open the vault URL
2. If locked, view the countdown timer
3. Once unlocked, click "Unlock" to decrypt
4. Content is displayed (and destroyed if burn-after-read is enabled)

### Backup & Restore

**Export single vault:**
- Click the export button next to any vault
- Save the `.vef.json` file

**Backup all vaults:**
- Click "Backup" in the vaults section
- Save the backup bundle

**Import vaults:**
- Click "Import" and select a `.vef.json` file
- Duplicates are automatically skipped

---

## Development

### Prerequisites

- Node.js 20+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/seal.git
cd seal

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Project Structure

```
seal/
├── src/
│   ├── lib/              # Core cryptographic and utility functions
│   │   ├── crypto.ts     # AES-GCM encryption
│   │   ├── tlock.ts      # Timelock encryption (drand)
│   │   ├── storage.ts    # IndexedDB persistence
│   │   └── vef.ts        # Vault Export Format
│   ├── components-vanilla/  # UI components
│   ├── styles/           # CSS modules
│   └── main.ts           # Application entry point
├── public/               # Static assets
└── scripts/              # Build and deployment scripts
```

### Architecture

- **No framework** — Pure TypeScript with vanilla DOM APIs
- **Component pattern** — Lightweight base class for state management
- **CSS Modules** — Scoped styling with design tokens
- **Event bus** — Minimal pub/sub for component communication

---

## Security Considerations

### Threat Model

**What Seal protects against:**
- ✅ Early access attempts by any party
- ✅ Manipulation of vault unlock times
- ✅ Server-side data breaches (no server-side storage)

**What Seal does NOT protect against:**
- ❌ Compromise of user's device before vault creation
- ❌ Loss of vault URLs (no recovery mechanism)
- ❌ Screen recording or keylogging on user's device
- ❌ Compromise of the drand network (extremely unlikely)

### Best Practices

1. **Verify the source** — Only use Seal from trusted domains or self-host
2. **Secure your device** — Ensure your device is malware-free when creating vaults
3. **Backup URLs securely** — Store vault links in a secure location
4. **Understand permanence** — Once armed, vaults cannot be modified or deleted from the network

---

## Vault Export Format (VEF)

Seal uses a versioned JSON format for vault backup and restore:

```json
{
  "vef_version": "2.0.0",
  "vault_id": "deterministic-content-hash",
  "encrypted_payload": "base64-encoded-ciphertext",
  "crypto": {
    "algorithm": "AES-GCM",
    "key_length": 256,
    "iv_length": 12
  },
  "tlock": {
    "chain_hash": "drand-quicknet-hash",
    "round": 123456789,
    "ciphertext": "tlock-encrypted-key"
  },
  "unlock_timestamp": 1234567890000,
  "created_at": 1234567890000
}
```

VEF files are:
- **Deterministic** — Same content produces same vault ID
- **Portable** — Import across devices and browsers
- **Idempotent** — Safe to import multiple times (duplicates skipped)
- **Forward compatible** — Versioned schema for future enhancements

---

## Design Philosophy

### Simplicity by Design

Seal treats vault content as opaque strings. It does not:
- Parse structured data formats
- Enforce content schemas
- Interpret semantic meaning
- Manage relationships between vaults

This intentional limitation keeps the tool focused and enables emergent use cases.

### Composability

Because Seal treats content as plain text, users can encode their own structure:

- **Chained disclosure** — Vault A contains link to Vault B
- **Staged reveals** — Instructions reference multiple time-locked vaults
- **Delegated workflows** — Vaults contain pointers to external systems

These patterns emerge from user creativity, not application features.

### No Recovery

Seal provides no recovery mechanism. This is a feature, not a bug:

- Ensures no backdoors exist
- Eliminates trusted recovery services
- Maintains strong security guarantees
- Forces users to take responsibility for backup

---

## Deployment

### IPFS Deployment

Seal can be deployed to IPFS for immutable, censorship-resistant hosting:

```bash
# Build the application
npm run build

# Deploy to IPFS using the release script
./scripts/release.sh
```

The release script:
1. Builds the production bundle
2. Publishes to IPFS
3. Pins on Pinata
4. Generates a release report with CID

### Traditional Hosting

Deploy the `dist/` folder to any static hosting service:

- **Cloudflare Pages** — Automatic builds from Git
- **Vercel** — Zero-configuration deployment
- **Netlify** — Continuous deployment
- **GitHub Pages** — Free hosting for open source

Configure your hosting to serve `index.html` for all routes.

---

## Contributing

Contributions are welcome! Please ensure:

- Code follows existing style (TypeScript, no frameworks)
- Changes maintain backward compatibility with VEF format
- Security-critical changes are clearly documented
- Tests pass (when test suite is added)

---

## License

This project is released into the public domain. See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- **drand network** — Distributed randomness beacon by the League of Entropy
- **tlock-js** — Timelock encryption library
- **Web Crypto API** — Browser-native cryptography

---

## Disclaimer

Seal is provided as-is without warranty. Users are responsible for:
- Verifying the application source code
- Securing their devices and vault URLs
- Understanding the cryptographic guarantees and limitations
- Complying with applicable laws and regulations

**Use at your own risk.**
