# Security Policy

## Overview

Seal is a cryptographic application that implements time-locked encryption. Security is our highest priority. This document outlines our security practices, known limitations, and how to report vulnerabilities.

## Threat Model

### What Seal Protects Against

- ✅ **Premature access** — Content cannot be decrypted before the unlock time by any party
- ✅ **Server-side breaches** — No server-side storage of keys or content
- ✅ **Man-in-the-middle attacks** — All cryptographic operations occur client-side
- ✅ **Time manipulation** — Unlock times are enforced by the drand network

### What Seal Does NOT Protect Against

- ❌ **Device compromise** — Malware on user's device during vault creation
- ❌ **Screen recording** — Physical or software-based screen capture
- ❌ **Keylogging** — Input capture before encryption
- ❌ **Loss of vault URLs** — No recovery mechanism exists by design
- ❌ **Browser vulnerabilities** — Security depends on Web Crypto API implementation
- ❌ **Drand network compromise** — Theoretical but extremely unlikely

## Cryptographic Guarantees

### Encryption

- **Algorithm**: AES-256-GCM (Web Crypto API)
- **Key Generation**: `crypto.getRandomValues()` (CSPRNG)
- **IV Length**: 96 bits (12 bytes), unique per encryption
- **Authentication**: Built-in with GCM mode

### Time-Lock

- **Protocol**: [tlock](https://github.com/drand/tlock) (Timelock Encryption)
- **Randomness Source**: [drand](https://drand.love) quicknet (mainnet)
- **Round Period**: 3 seconds
- **Network**: Distributed across 20+ independent organizations

### Key Management

- **Symmetric Key**: 256-bit, generated per vault, never stored unencrypted
- **Key Encryption**: tlock-encrypted using future drand round
- **Key Lifecycle**: Generated → Used → Encrypted → Discarded

## Known Limitations

1. **No Backward Compatibility Guarantee**
   - VEF format may change between major versions
   - Migration tools will be provided when possible

2. **Drand Network Dependency**
   - Decryption requires internet access to fetch drand randomness
   - Network downtime delays but does not prevent unlocking

3. **Browser Security Boundary**
   - Security relies on browser's Web Crypto API implementation
   - Browser extensions can potentially access page content

4. **No Forward Secrecy for URLs**
   - Vault URLs contain encrypted payload
   - Anyone with the URL can decrypt after unlock time
   - URLs should be transmitted over secure channels

5. **Time Zone Handling**
   - All times internally use Unix timestamps (UTC)
   - UI displays local time which may cause confusion

## Security Best Practices

### For Users

1. **Verify Application Source**
   - Only use Seal from trusted domains or self-host
   - Verify IPFS CID matches official releases
   - Check browser console for errors or warnings

2. **Secure Your Device**
   - Use updated browser with security patches
   - Scan for malware before creating vaults
   - Avoid public/shared computers for sensitive vaults

3. **Protect Vault URLs**
   - Treat URLs as secrets after unlock time
   - Use encrypted channels for transmission
   - Store URLs securely (password manager, encrypted storage)

4. **Backup Wisely**
   - Export vaults to secure offline storage
   - Use `.vef.json` format for maximum portability
   - Encrypt backup files with additional layer if needed

5. **Understand Permanence**
   - Once armed, vaults cannot be modified
   - No recovery mechanism if URL is lost
   - Test with non-critical data first

### For Developers

1. **Dependency Management**
   - Regularly update dependencies (`npm audit fix`)
   - Review security advisories for critical packages
   - Pin dependency versions for reproducible builds

2. **Code Review**
   - All cryptographic code changes require review
   - Test vectors for crypto functions
   - Audit third-party integrations

3. **Build Security**
   - Verify build reproducibility
   - Use Subresource Integrity (SRI) for CDN resources
   - Implement Content Security Policy (CSP)

4. **Deployment**
   - Serve over HTTPS only
   - Use HSTS headers
   - Deploy to IPFS for immutable releases

## Reporting a Vulnerability

### Scope

We accept security reports for:

- Cryptographic implementation flaws
- Authentication/authorization bypasses
- Cross-site scripting (XSS)
- Injection vulnerabilities
- Logic errors in time-lock implementation
- Dependency vulnerabilities (critical/high severity)

### Out of Scope

- Denial of service attacks
- Rate limiting issues
- Social engineering
- Physical security
- Issues requiring physical access to user's device

### How to Report

**Please DO NOT open public GitHub issues for security vulnerabilities.**

Instead, report privately via one of these methods:

1. **GitHub Security Advisories** (Preferred)
   - Go to repository Security tab
   - Click "Report a vulnerability"
   - Fill out the form with details

2. **Email** (Alternative)
   - Send to: [YOUR-EMAIL]
   - Use PGP key: [PGP-KEY-ID] (optional)
   - Include "SECURITY" in subject line

### What to Include

A good security report includes:

- **Description** — Clear explanation of the vulnerability
- **Impact** — What an attacker could achieve
- **Reproduction** — Step-by-step instructions to reproduce
- **Proof of Concept** — Code or screenshots if applicable
- **Suggested Fix** — If you have ideas for remediation

### What to Expect

| Timeline | Action |
|----------|--------|
| 24 hours | Initial acknowledgment |
| 7 days | Preliminary assessment |
| 30 days | Detailed response or fix |
| 90 days | Public disclosure (coordinated) |

We will:
- Keep you informed of our progress
- Credit you in release notes (if desired)
- Work with you on coordinated disclosure
- Not take legal action against good-faith researchers

## Security Updates

### Version Support

| Version | Supported |
|---------|-----------|
| 0.3.x   | ✅ Yes    |
| 0.2.x   | ❌ No     |
| 0.1.x   | ❌ No     |

Only the latest minor version receives security updates.

### Update Notifications

Security updates are announced via:
- GitHub Security Advisories
- Release notes on GitHub
- CHANGELOG.md

Users are responsible for updating to secure versions.

## Security Audit History

**No formal audits have been conducted.**

This project is maintained by individual contributors. While we follow security best practices, the code has not undergone professional security audit. Use at your own risk.

If you represent a security firm interested in auditing this project, please contact us.

## Cryptographic Algorithms

### Current

- **Encryption**: AES-256-GCM (Web Crypto API)
- **Key Derivation**: None (keys are random)
- **Time-Lock**: IBE-based tlock via drand
- **Hashing**: SHA-256 (for vault IDs)

### Deprecated

None yet (project is at v0.3.0).

### Future Considerations

- Post-quantum resistant algorithms (monitoring NIST standards)
- Alternative time-lock schemes (if drand changes)
- Hardware security module (HSM) support for enterprise use

## Compliance

Seal is designed for:
- **Personal use** — No guarantees for regulated environments
- **Non-production data** — Not audited for critical systems
- **Educational purposes** — Understanding time-lock cryptography

**NOT suitable for:**
- Healthcare (HIPAA compliance required)
- Financial services (SOC 2 required)
- Government classified data
- Mission-critical systems

## Contact

- **General Questions**: GitHub Issues
- **Security Issues**: See "Reporting a Vulnerability" above
- **Project Maintainer**: Janko <simonovic86@gmail.com>

---

**Last Updated**: 2026-01-27
**Version**: 0.3.0
