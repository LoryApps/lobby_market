'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function FingerprintError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="flex items-center justify-center h-14 w-14 mx-auto mb-4 rounded-2xl bg-against-500/10 border border-against-500/30">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <h1 className="font-mono text-lg font-bold text-white mb-2">Fingerprint unavailable</h1>
        <p className="text-sm text-surface-500 mb-6">
          {error.message ?? 'Failed to load your civic fingerprint. Please try again.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-surface-200 text-surface-500 text-sm font-mono hover:text-white transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
