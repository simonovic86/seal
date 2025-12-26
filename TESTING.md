# Manual Testing Guide

## Current Status

The app has been migrated from Next.js + React to Vanilla TypeScript + Vite.

**Dev Server:** http://localhost:3000/

## Known Issues Fixed

1. ✅ Input focus loss - Fixed
2. ✅ Custom time picker toggling - Fixed  
3. ✅ crypto.randomUUID() compatibility - Fixed with fallback
4. ✅ undefined.slice() errors - Fixed with null checks
5. ✅ updateInputFormState undefined - Removed dead code

## Test Flow

### 1. Create a Vault

1. Open http://localhost:3000/
2. Enter a secret message (e.g., "This is my test secret")
3. Click "1h" time preset
4. Verify "Unlocks at:" shows correct time
5. Click "Lock Secret" button
6. **Expected:** Progress screen appears showing encryption steps
7. **Expected:** Success screen with shareable link
8. **If fails:** Open DevTools console (F12) and share the error

### 2. View Vault List

1. After creating vault, scroll down
2. **Expected:** See "Your Vaults" section
3. **Expected:** New vault appears in list
4. Click on a vault

### 3. Unlock a Vault

1. Click "Test Vault" or any "Ready to unlock" vault
2. **Expected:** Navigate to `/vault.html?id=...`
3. **Expected:** See "Ready to Unlock" screen
4. Click "Unlock Vault"
5. **Expected:** Progress: "Connecting to Lit Network..."
6. **Expected:** Decrypted secret appears
7. Click "Copy Secret"
8. **Expected:** Toast "Secret copied!" appears

### 4. Test Backup/Restore

1. Go to home page
2. Click "Backup" button
3. **Expected:** Toast "Backup link copied!"
4. Open new private/incognito window
5. Paste the backup URL
6. **Expected:** Redirect to restore page
7. Click "Restore" button
8. **Expected:** Vaults restored
9. Click "View Your Vaults"
10. **Expected:** See all vaults

## Debugging

If anything fails, check browser console (F12) for:
- Network errors (Lit Protocol connection)
- JavaScript errors (component bugs)
- Console.log output (validation failures)

Share any errors you see and I can fix them!

##Current Commits

```
e083c3d Fix crypto.randomUUID() compatibility and undefined slice errors
6124e81 Remove call to deleted updateInputFormState method  
4fa1c9c Simplify CreateVaultForm update logic
f773854 Fix form state management - read values from DOM
69b344f Fix Custom time picker not working after switching from presets
a114283 Fix input focus loss on typing
```

