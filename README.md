# Lock

Time-locked encryption for the browser.

---

## What it does

Lock creates encrypted vaults that cannot be opened until a specified time.

- You write something.
- You choose when it unlocks.
- You get a URL.

Before the unlock time, the content is inaccessible.  
After the unlock time, anyone with the URL can decrypt it.

---

## What you can lock

Plain text.

The content is treated as an opaque string. Lock does not parse, validate, or interpret what you write. If a line looks like a URI, it renders as a clickable link. Otherwise, it renders as text.

---

## How it behaves

**Creating a vault:**
1. Enter your content and unlock time.
2. Review the draft (encrypted locally, not yet committed).
3. Arm the vault (irreversible — creates the time-lock and saves).

**Opening a vault:**
- Before unlock time: countdown displayed, content inaccessible.
- After unlock time: content decrypted and displayed.

**No accounts. No backend. No recovery.**

Vaults exist only as URLs and local references. If you lose the link, the content is gone.

---

## What it is not

- Not a password manager
- Not a scheduling tool
- Not a messaging platform
- Not a workflow system

Lock does one thing: seal content until a time, then unseal it.

---

## Technical notes

- Encryption: AES-GCM, client-side
- Time-lock: Lit Protocol threshold cryptography
- Storage: Browser localStorage for vault references
- No server-side storage of content or keys

---

## Status

Functional. The feature set is intentionally minimal.

---

## Philosophy

Information sealed until its time. Nothing more.
