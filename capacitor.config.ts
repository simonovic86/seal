import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Seal Mobile App Configuration
 *
 * This is a thin native shell around the Seal web app.
 * The web app remains the single source of truth.
 *
 * Modes:
 * - Production: Set SEAL_IPFS_URL env var to load from IPFS gateway
 * - Local/Review: Uses bundled dist/ assets (for App Store review)
 */

// IPFS gateway URL for the pinned release
// Set this to your deployed IPFS gateway URL, e.g.:
// https://your-cid.ipfs.dweb.link or https://ipfs.io/ipfs/your-cid
const IPFS_GATEWAY_URL = process.env.SEAL_IPFS_URL || '';

const config: CapacitorConfig = {
  appId: 'app.seal.vault',
  appName: 'Seal',
  webDir: 'dist',

  // Server configuration
  server: {
    // When IPFS URL is set, load from remote gateway
    // Otherwise, load from bundled dist/ assets
    ...(IPFS_GATEWAY_URL
      ? {
          url: IPFS_GATEWAY_URL,
          cleartext: false, // HTTPS only
        }
      : {}),

    // Allow navigation to IPFS gateways and related domains
    allowNavigation: [
      'ipfs.io',
      '*.ipfs.io',
      '*.ipfs.dweb.link',
      'dweb.link',
      '*.dweb.link',
      'cloudflare-ipfs.com',
      '*.cloudflare-ipfs.com',
      'gateway.pinata.cloud',
      '*.pinata.cloud',
      'w3s.link',
      '*.w3s.link',
    ],

    // Error handling - show failure honestly
    errorPath: undefined, // Use default browser error handling
  },

  // iOS-specific configuration
  ios: {
    // Use WKWebView (default and required)
    // No custom URL schemes needed
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: true,

    // Disable features we don't need
    limitsNavigationsToAppBoundDomains: false,

    // WebView preferences
    preferredContentMode: 'mobile',
  },

  // Android-specific configuration
  android: {
    // WebView settings
    allowMixedContent: false, // HTTPS only
    captureInput: true, // Enable file picker input
    webContentsDebuggingEnabled: false, // Disable for production

    // Disable features we don't need
    useLegacyBridge: false,
  },

  // Plugins configuration
  plugins: {
    // Filesystem for backup/restore
    Filesystem: {
      // Request permissions when needed
    },

    // Keyboard handling
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },

  // Disable features not needed
  // No push notifications
  // No background tasks
  // No analytics

  // Logging - minimal
  loggingBehavior: 'none',
};

export default config;
