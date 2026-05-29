'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function PersuasionError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[PersuasionPage]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h2 className="text-base font-mono font-bold text-white mb-2">
          Couldn&apos;t load persuasion data
        </h2>
        <p className="text-sm text-surface-500 mb-6">
          {error.message || 'Something went wrong. Please try again.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
          <Link
            href="/analytics"
            className="px-4 py-2 rounded-xl bg-for-500/10 border border-for-500/30 text-sm font-mono text-for-400 hover:bg-for-500/20 transition-colors"
          >
            Analytics →
          </Link>
        </div>
      </div>
    </div>
  )
}
