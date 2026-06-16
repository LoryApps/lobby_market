'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'

export default function DepthLeaderboardError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="h-10 w-10 text-against-400 mb-4" />
      <h1 className="text-lg font-bold text-white mb-2">Something went wrong</h1>
      <p className="text-sm text-surface-500 mb-6 max-w-xs">
        {error.message ?? 'Failed to load the Depth League leaderboard.'}
      </p>
      <div className="flex gap-3">
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm text-white hover:bg-surface-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-semibold hover:bg-for-500 transition-colors"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    </div>
  )
}
