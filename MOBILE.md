# Seal Mobile Apps

Seal mobile apps are thin native shells around the existing web app.
The web app remains the single source of truth — no business logic
or encryption code runs in the native layer.

## Architecture

```
┌─────────────────────────────────────────┐
│              Mobile App                 │
│  ┌───────────────────────────────────┐  │
│  │         Native Shell              │  │
│  │  (WKWebView / Android WebView)    │  │
│  └───────────────────────────────────┘  │
│                  │                      │
│                  ▼                      │
│  ┌───────────────────────────────────┐  │
│  │         Seal Web App              │  │
│  │  (IPFS Gateway or Local Assets)   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Prerequisites

- **Node.js** 20+
- **iOS**: Xcode 15+, CocoaPods
- **Android**: Android Studio, JDK 17+

## Quick Start

```bash
# Install dependencies
npm install

# Build web assets and sync to native projects
npm run cap:sync

# Open in Xcode (iOS)
npm run cap:ios

# Open in Android Studio
npm run cap:android
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run cap:sync` | Build web + sync to iOS & Android |
| `npm run cap:ios` | Build, sync, and open Xcode |
| `npm run cap:android` | Build, sync, and open Android Studio |
| `npm run cap:ios:run` | Build, sync, and run on iOS device/simulator |
| `npm run cap:android:run` | Build, sync, and run on Android device/emulator |

## Configuration

### Loading Mode

The app can load from two sources:

1. **IPFS Gateway (Production)**
   
   Set the `SEAL_IPFS_URL` environment variable:
   ```bash
   SEAL_IPFS_URL=https://your-cid.ipfs.dweb.link npm run cap:sync
   ```

2. **Local Assets (Development / App Store Review)**
   
   Without the env var, the app loads from bundled `dist/` assets.

### Capacitor Config

Edit `capacitor.config.ts` to modify:
- App ID: `app.seal.vault`
- Allowed navigation domains (IPFS gateways)
- Platform-specific settings

## Platform Details

### iOS

- **Minimum iOS**: 14.0
- **WebView**: WKWebView (system default)
- **Project**: `ios/App/App.xcworkspace`

Key files:
- `ios/App/App/Info.plist` - App configuration
- `ios/App/Podfile` - iOS dependencies

### Android

- **Minimum SDK**: 22 (Android 5.1)
- **Target SDK**: 34 (Android 14)
- **WebView**: System WebView
- **Project**: `android/`

Key files:
- `android/app/src/main/AndroidManifest.xml` - App manifest
- `android/app/src/main/res/xml/network_security_config.xml` - Network security
- `android/app/src/main/res/values/strings.xml` - App strings

## Features Enabled

| Feature | Status |
|---------|--------|
| Local Storage | ✅ Enabled |
| File Picker (backup/restore) | ✅ Enabled |
| HTTPS Only | ✅ Enforced |
| Deep Links | ✅ Supported |

## Features Disabled

| Feature | Reason |
|---------|--------|
| Push Notifications | Not needed |
| Background Tasks | Not needed |
| Native Menus | Web-only UI |
| Analytics | Privacy |
| Auto-Updates | Explicit releases only |
| Offline Mode | No caching guarantees |

## Offline Behavior

The app does not promise offline functionality:

- If the IPFS gateway is unavailable, the app shows the browser's
  native error state
- No decrypted content is cached outside browser storage
- Local storage persists per platform (default WebView behavior)

## Building for Release

### iOS

1. Open in Xcode: `npm run cap:ios`
2. Select "Any iOS Device" as build target
3. Product → Archive
4. Distribute via App Store Connect

### Android

1. Open in Android Studio: `npm run cap:android`
2. Build → Generate Signed Bundle/APK
3. Create or select signing key
4. Upload to Google Play Console

## App Store Considerations

For app store submission, use local assets mode (no `SEAL_IPFS_URL`):

```bash
# Build with bundled assets for store review
npm run cap:sync
```

This ensures the app works during review without network dependencies.

## Testing Checklist

Before release, verify:

- [ ] Vault creation works
- [ ] Countdown displays correctly
- [ ] Unlock behavior at target time
- [ ] Backup file download works
- [ ] Restore from backup file works
- [ ] Local storage persists across app restarts
- [ ] App shows error when offline (no false promises)

## Troubleshooting

### iOS: Pod install fails

```bash
cd ios/App
pod install --repo-update
```

### Android: Gradle sync fails

Open Android Studio and let it sync automatically.
Or run:
```bash
cd android
./gradlew sync
```

### WebView shows blank page

1. Check that `dist/` exists: `npm run build`
2. Run sync: `npx cap sync`
3. Check console logs in Safari (iOS) or Chrome DevTools (Android)

### IPFS gateway unreachable

The app will show the browser's native error. This is intentional —
we don't make offline promises. Try a different gateway or check
your network connection.

## Updating the Web App

After changing web code:

```bash
# Rebuild and sync
npm run cap:sync

# Rerun on device
npm run cap:ios:run
# or
npm run cap:android:run
```

## Philosophy

These mobile apps are **distribution wrappers**, not feature forks:

- ✅ Same code, same behavior
- ✅ No mobile-only features
- ✅ No semantic changes
- ✅ Apps are replaceable without data loss
- ✅ Web app remains canonical

If a user loses their mobile app, they can always access Seal
through a web browser with the same local storage data.
