'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, BarChart2, RefreshCw } from 'lucide-react'

export default function ConvergenceError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ConvergenceError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-against-400" />
          </div>
        </div>
        <div>
          <h1 className="font-mono text-xl font-bold text-white mb-2">Convergence unavailable</h1>
          <p className="text-sm text-surface-500 font-mono">
            Could not load convergence data. Try again in a moment.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 text-white text-sm font-mono font-medium hover:bg-for-500 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <Link
            href="/drift"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-white text-sm font-mono font-medium hover:bg-surface-300 transition-colors"
          >
            <BarChart2 className="h-4 w-4" />
            Opinion Drift
          </Link>
        </div>
      </div>
    </div>
  )
}
