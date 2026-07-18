'use client'

import Link from 'next/link'
import { Activity, RefreshCw } from 'lucide-react'

export default function CatalystsError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="h-12 w-12 rounded-2xl bg-against-500/10 border border-against-500/20 flex items-center justify-center mx-auto">
          <Activity className="h-6 w-6 text-against-400" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-mono font-bold text-white">Catalysts unavailable</h1>
        <p className="text-sm text-surface-500">
          Could not load market catalyst data. Please try again.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 text-white text-sm font-mono font-semibold hover:bg-for-500 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </button>
          <Link
            href="/exchange"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-white text-sm font-mono font-semibold hover:bg-surface-300 transition-colors"
          >
            Exchange
          </Link>
        </div>
      </div>
    </div>
  )
}
