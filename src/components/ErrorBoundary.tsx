'use client';

import { Component, ReactNode } from 'react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component to catch and display errors gracefully
 * instead of showing a blank white screen
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-lg mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
            {/* Error icon */}
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h1 className="text-xl font-semibold text-zinc-100 mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-zinc-400 mb-6">
              An unexpected error occurred. Your data is safe — try refreshing or go back home.
            </p>

            {/* Error details (collapsed by default in production) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
                  Technical details
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-zinc-800 text-xs text-red-400 overflow-auto max-h-32">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 py-3 rounded-lg font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Try Again
              </button>
              <Link
                href="/"
                className="flex-1 py-3 rounded-lg font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors text-center"
              >
                Go Home
              </Link>
            </div>

            <p className="mt-6 text-xs text-zinc-600">
              Your encrypted vaults remain safe and unchanged.
            </p>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

