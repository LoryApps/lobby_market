'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function Error({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-2xl border border-against-500/30 bg-surface-100 p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-against-400 mx-auto mb-4" />
        <h1 className="font-mono text-lg font-bold text-white mb-2">
          Doctrine unavailable
        </h1>
        <p className="text-sm font-mono text-surface-500 mb-6">
          The Civic Doctrine could not be loaded. Please try again.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-500/20 border border-for-500/30 text-sm font-mono text-for-300 hover:bg-for-500/30 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
