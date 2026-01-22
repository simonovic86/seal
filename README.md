# Seal

Time-locked encryption for the browser.

> The codebase uses "lock" in filenames and identifiers. The application is called Seal.

---

## What it does

Seal creates encrypted vaults that cannot be opened until a specified time.

- You write something.
- You choose when it unlocks.
- You get a URL.

Before the unlock time, the content is inaccessible.  
After the unlock time, anyone with the URL can decrypt it.

---

## What you can seal

Plain text.

The content is treated as an opaque string. Seal does not parse, validate, or interpret what you write. If a line looks like a URI, it renders as a clickable link. Otherwise, it renders as text.

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

Seal does one thing: hold content until a time, then release it.

---

## Technical notes

- Encryption: AES-GCM, client-side
- Time-lock: drand (tlock) - distributed randomness beacon
- Storage: Browser localStorage for vault references
- No server-side storage of content or keys

---

## Status

Functional. The feature set is intentionally minimal.

---

## Open Design Space

Seal treats payloads as opaque. It does not parse structure, enforce schemas, or interpret meaning. This is intentional.

Because vault content can include URIs — including references to other vaults — composition becomes possible without Seal implementing it:

- A vault could contain a link to another vault (chained disclosure)
- A vault could contain instructions that reference future vaults (staged reveals)
- A vault could contain pointers to external systems (delegated workflows)

None of this is a feature of Seal. Seal does not manage graphs, enforce sequencing, or track relationships. Any higher-level structure exists entirely in the payload, defined by whoever creates it.

This design leaves the tool simple and the possibilities open.

---

## Philosophy

Information sealed until its time. Nothing more.
