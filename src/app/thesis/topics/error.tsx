'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ThesisTopicsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
            <AlertTriangle className="h-7 w-7 text-against-400" aria-hidden="true" />
          </div>
        </div>
        <div>
          <h1 className="font-mono text-xl font-bold text-white mb-1">Failed to load</h1>
          <p className="text-sm text-surface-500 font-mono">
            Could not fetch thesis battlegrounds.
          </p>
          {error.digest && (
            <p className="text-[11px] text-surface-600 font-mono mt-1">ref: {error.digest}</p>
          )}
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
      </div>
    </div>
  )
}
