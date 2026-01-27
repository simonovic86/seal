# Contributing to Seal

Thank you for your interest in contributing to Seal! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Security](#security)

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other contributors

### Unacceptable Behavior

- Harassment, trolling, or discriminatory language
- Publishing others' private information
- Personal attacks or political arguments
- Spam or off-topic discussions

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm or yarn package manager
- Git
- A code editor (VS Code recommended)

### Initial Setup

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR-USERNAME/seal.git
cd seal

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL-OWNER/seal.git

# Install dependencies
npm install

# Start development server
npm run dev
```

### Project Structure

```
seal/
├── src/
│   ├── lib/              # Core libraries
│   │   ├── crypto.ts     # Encryption functions
│   │   ├── tlock.ts      # Time-lock implementation
│   │   ├── storage.ts    # Browser storage
│   │   └── vef.ts        # Vault Export Format
│   ├── components-vanilla/  # UI components
│   ├── styles/           # CSS modules
│   └── main.ts           # Entry point
├── public/               # Static assets
├── scripts/              # Build/deployment scripts
└── tests/                # Test files (when added)
```

## Development Workflow

### Branching Strategy

- `main` — Production-ready code
- `feature/*` — New features
- `fix/*` — Bug fixes
- `docs/*` — Documentation changes
- `refactor/*` — Code improvements

### Creating a Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name
```

### Making Changes

1. **Write Code**
   - Follow coding standards (see below)
   - Keep commits small and focused
   - Write clear commit messages

2. **Test Locally**
   ```bash
   npm run dev      # Start dev server
   npm run build    # Test production build
   npm test         # Run tests (when added)
   ```

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add awesome feature"
   ```

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation only
- `style` — Code style (formatting, semicolons)
- `refactor` — Code change that neither fixes bug nor adds feature
- `test` — Adding or updating tests
- `chore` — Build process, tooling, dependencies

**Examples:**
```bash
feat: add burn-after-reading option
fix: date picker not visible on mobile
docs: update README with deployment instructions
refactor: simplify base64 encoding logic
test: add unit tests for crypto functions
chore: update dependencies to latest
```

## Coding Standards

### TypeScript

- **Strict mode enabled** — All code must type-check
- **No `any` types** — Use `unknown` or proper types
- **Explicit return types** — For public functions
- **No console.log** — Use proper logging (or remove before commit)

### Code Style

```typescript
// ✅ Good
export async function encryptVault(
  content: string,
  unlockTime: number,
): Promise<VaultRef> {
  const key = await generateKey();
  const encrypted = await encrypt(content, key);
  return { encrypted, unlockTime };
}

// ❌ Bad
export async function encryptVault(content, unlockTime) {
  let key = await generateKey()
  let encrypted = await encrypt(content, key)
  return { encrypted: encrypted, unlockTime: unlockTime }
}
```

### File Organization

- **One component per file**
- **Group related functionality**
- **Export public API at end**
- **Import order**: external → internal → types

```typescript
// External dependencies first
import { timelockEncrypt } from 'tlock-js';
import { get, set } from 'idb-keyval';

// Internal dependencies
import { generateKey } from './crypto';
import { toBase64 } from './encoding';

// Types last
import type { VaultRef } from './storage';
```

### CSS Modules

- **Use design tokens** — Reference `tokens.css` variables
- **Mobile-first** — Desktop styles in media queries
- **BEM-like naming** — Descriptive class names
- **No inline styles** — Except dynamic values

```css
/* ✅ Good */
.vaultCard {
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

@media (min-width: 768px) {
  .vaultCard {
    padding: var(--space-6);
  }
}

/* ❌ Bad */
.card {
  padding: 16px;
  background: #1a1a1a;
  border: 1px solid #333;
}
```

### Documentation

- **JSDoc for public APIs**
- **Inline comments for complex logic**
- **README for user-facing features**
- **Code is self-documenting** — Clear names over comments

```typescript
/**
 * Creates a time-locked vault that cannot be opened until the specified time.
 *
 * @param content - The plaintext content to encrypt
 * @param unlockTime - Unix timestamp (ms) when vault becomes unlockable
 * @param options - Optional vault configuration
 * @returns Promise resolving to vault reference
 * @throws {Error} If unlock time is in the past
 *
 * @example
 * ```typescript
 * const vault = await createVault(
 *   "Secret message",
 *   Date.now() + 86400000, // 24 hours
 *   { destroyAfterRead: true }
 * );
 * ```
 */
export async function createVault(
  content: string,
  unlockTime: number,
  options?: VaultOptions,
): Promise<VaultRef> {
  // Implementation
}
```

## Testing

### Running Tests

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm test -- crypto    # Run specific test file
npm run test:coverage # Generate coverage report
```

### Writing Tests

- **Unit tests** — Pure functions, business logic
- **Integration tests** — Component interactions
- **E2E tests** — Critical user flows (future)

```typescript
import { describe, it, expect } from 'vitest';
import { toBase64, fromBase64 } from '../src/lib/encoding';

describe('encoding', () => {
  describe('toBase64', () => {
    it('should encode Uint8Array to base64', () => {
      const data = new Uint8Array([72, 101, 108, 108, 111]);
      const result = toBase64(data);
      expect(result).toBe('SGVsbG8');
    });

    it('should produce URL-safe base64', () => {
      const data = new Uint8Array([255, 255, 255]);
      const result = toBase64(data);
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
    });
  });

  describe('fromBase64', () => {
    it('should decode base64 to Uint8Array', () => {
      const result = fromBase64('SGVsbG8');
      expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it('should handle URL-safe base64', () => {
      const encoded = toBase64(new Uint8Array([255, 255, 255]));
      const decoded = fromBase64(encoded);
      expect(decoded).toEqual(new Uint8Array([255, 255, 255]));
    });
  });
});
```

### Test Coverage Goals

- **Cryptographic functions** — 100%
- **Business logic** — 90%+
- **UI components** — 70%+
- **Overall** — 80%+

## Pull Request Process

### Before Submitting

- [ ] Code builds without errors (`npm run build`)
- [ ] Tests pass (`npm test`)
- [ ] Code follows style guidelines
- [ ] Commits follow conventional format
- [ ] Branch is up to date with main
- [ ] Self-review completed

### PR Checklist

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to break)
- [ ] Documentation update

## Testing
How has this been tested?

## Security Impact
Does this change affect cryptography, authentication, or data handling?

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where needed
- [ ] I have updated documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing tests pass locally
```

### Review Process

1. **Automated Checks**
   - Build verification
   - Test suite
   - Lint checks
   - Type checking

2. **Manual Review**
   - Code quality
   - Security implications
   - Performance impact
   - Documentation

3. **Approval**
   - At least 1 maintainer approval required
   - All CI checks must pass
   - Conflicts must be resolved

4. **Merge**
   - Squash and merge (for features)
   - Rebase and merge (for fixes)
   - Maintainer will merge when ready

### After Merge

- Delete your feature branch
- Pull latest main
- Celebrate! 🎉

## Security

**Do not include security vulnerabilities in public PRs.**

If you discover a security issue:
1. Do NOT open a public issue
2. Follow the [Security Policy](SECURITY.md)
3. Report privately via GitHub Security Advisories

## Special Considerations

### Cryptographic Changes

Changes to cryptographic code require extra scrutiny:

- **Breaking changes** — May require VEF version bump
- **Test vectors** — Provide known-good inputs/outputs
- **Security review** — Tag maintainers for review
- **Documentation** — Explain cryptographic decisions

### VEF Format Changes

The Vault Export Format is versioned. Changes require:

- Version bump in `vef.ts`
- Migration guide in `CHANGELOG.md`
- Backward compatibility tests
- Update README examples

### UI/UX Changes

For user-facing changes:

- Test on mobile and desktop
- Verify accessibility (keyboard navigation, screen readers)
- Include screenshots in PR description
- Consider i18n implications (future)

## Recognition

Contributors are recognized in:
- Release notes
- README acknowledgments
- Git commit history

Thank you for contributing to Seal! 🚀
