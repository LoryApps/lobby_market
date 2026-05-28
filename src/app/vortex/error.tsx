'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function VortexError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Vortex page error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-xl bg-against-500/20 border border-against-500/40 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Vortex disrupted</h2>
        <p className="text-sm text-surface-400 mb-6">
          The argument data couldn&apos;t be loaded. Try refreshing the page.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-against-500/20 border border-against-500/40 text-against-300 text-sm font-semibold hover:bg-against-500/30 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200/60 border border-surface-300/50 text-surface-300 text-sm font-semibold hover:bg-surface-300/60 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
