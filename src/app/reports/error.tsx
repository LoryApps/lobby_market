'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ReportsError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-against-400" />
          </div>
        </div>
        <p className="font-mono font-bold text-white text-lg">Failed to load reports</p>
        <p className="text-sm text-surface-500 font-mono">
          {error.message ?? 'The committee reports board is temporarily unavailable.'}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    </div>
  )
}
