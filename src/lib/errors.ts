/**
 * User-friendly error messages and error handling
 */

interface ErrorInfo {
  title: string;
  message: string;
  recoverable: boolean;
}

/**
 * Convert technical errors to user-friendly messages
 */
export function getFriendlyError(error: Error): ErrorInfo {
  const msg = error.message.toLowerCase();

  // drand/tlock errors
  if (msg.includes('round') && (msg.includes('not yet') || msg.includes('future'))) {
    return {
      title: 'Time Lock Active',
      message: 'This vault is still locked. Please wait until the unlock time.',
      recoverable: false,
    };
  }

  if (msg.includes('drand') || msg.includes('beacon')) {
    return {
      title: 'Network Connection Failed',
      message: 'Could not connect to the drand randomness beacon. Please check your internet connection and try again.',
      recoverable: true,
    };
  }

  if (msg.includes('tlock') && msg.includes('decrypt')) {
    return {
      title: 'Decryption Failed',
      message: 'Could not decrypt the timelock. The vault may be corrupted or not yet unlockable.',
      recoverable: false,
    };
  }

  // IPFS errors
  if (msg.includes('ipfs') && msg.includes('upload')) {
    return {
      title: 'Upload Failed',
      message: 'Could not upload to IPFS. Please check your internet connection and try again.',
      recoverable: true,
    };
  }

  if (msg.includes('fetch') && msg.includes('ipfs')) {
    return {
      title: 'Download Failed',
      message: 'Could not retrieve data from IPFS. The content may be temporarily unavailable.',
      recoverable: true,
    };
  }

  if (msg.includes('pinata') || msg.includes('jwt')) {
    return {
      title: 'Configuration Error',
      message: 'IPFS service not configured. Please set up the Pinata API key.',
      recoverable: false,
    };
  }

  // Network errors
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
    return {
      title: 'Network Error',
      message: 'Connection failed. Please check your internet and try again.',
      recoverable: true,
    };
  }

  // Decryption errors
  if (msg.includes('decrypt')) {
    return {
      title: 'Decryption Failed',
      message: 'Could not decrypt the data. The vault may be corrupted or the link incomplete.',
      recoverable: false,
    };
  }

  // Generic fallback
  return {
    title: 'Something went wrong',
    message: error.message || 'An unexpected error occurred. Please try again.',
    recoverable: true,
  };
}
