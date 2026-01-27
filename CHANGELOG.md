# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-01-27

### Added

- Professional documentation (README, SECURITY.md, CONTRIBUTING.md)
- Comprehensive test suite with Vitest (40 tests)
- ESLint and Prettier configuration
- GitHub Actions CI/CD pipeline
- LICENSE file (UNLICENSE - public domain)
- CHANGELOG for version tracking
- Package.json metadata (keywords, repository, bugs)
- Input field styling improvements for mobile visibility

### Changed

- README completely rewritten with professional structure
- Package.json updated with proper metadata
- Date/time input fields now more visible on mobile devices

### Removed

- Unused SVG assets (Next.js template leftovers)
- Unused retry.ts module
- Duplicate base64 functions from crypto.ts
- Dead IPFS error handling from errors.ts
- Unused exports: `roundToTime`, `getChainInfo`, `generateVaultName`
- Unused methods: `EventBus.off()`, `Component.afterRender()`
- Trailing whitespace across multiple files

### Fixed

- Date and time input fields visibility on iOS/mobile browsers
- Missing font styling for date/time input types

## [0.2.0] - 2026-01-22

### Changed

- Replaced Lit Protocol with drand/tlock for timelock encryption
- Migrated from Capacitor to PWA-only architecture
- Vault Export Format (VEF) upgraded to v2.0 (incompatible with v1.0)

### Removed

- Capacitor mobile app framework
- Lit Protocol dependencies
- IPFS upload functionality

## [0.1.0] - 2026-01-20

### Added

- Initial release with Lit Protocol
- Basic vault creation and unlocking
- PWA support
- Backup and restore functionality

---

## Version Support

| Version | Status | Support End |
|---------|--------|-------------|
| 0.3.x   | ✅ Current | TBD |
| 0.2.x   | ⚠️ Maintenance | 2026-03-31 |
| 0.1.x   | ❌ End of Life | 2026-02-01 |

## Migration Guides

### v1.0 to v2.0 (Lit → drand/tlock)

VEF v1.0 files (Lit Protocol) are **not compatible** with v2.0 (drand/tlock). 

**Why?** 
- Different cryptographic primitives
- Different unlock mechanisms
- No migration path available

**What to do?**
- Unlock all v1.0 vaults before upgrading
- Save the decrypted content
- Re-create vaults in v2.0 if needed
