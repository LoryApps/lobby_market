'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function EquilibriumError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[EquilibriumError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30">
            <AlertTriangle className="h-5 w-5 text-against-400" />
          </div>
        </div>
        <div>
          <h1 className="font-mono text-lg font-bold text-white mb-1">Equilibrium failed to load</h1>
          <p className="text-sm text-surface-500 font-mono">
            Could not compute platform stability data. Try refreshing.
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try Again
        </button>
      </div>
    </div>
  )
}
