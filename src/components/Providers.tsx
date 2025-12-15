'use client';

import { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Client-side providers wrapper
 * Includes error boundary and any future context providers
 */
export function Providers({ children }: ProvidersProps) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

