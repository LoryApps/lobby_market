'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Flame, RotateCcw } from 'lucide-react'

export default function StreaksError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Streaks page error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center space-y-4">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30 mx-auto">
          <Flame className="h-6 w-6 text-against-400" aria-hidden />
        </div>
        <div>
          <h2 className="font-mono font-bold text-white text-lg mb-1">
            Streak Hall unavailable
          </h2>
          <p className="text-sm font-mono text-surface-500">
            Could not load the leaderboard. The streak data is temporarily unavailable.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-surface-200 hover:bg-surface-300 text-white text-sm font-mono transition-colors w-full"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Try again
          </button>
          <Link
            href="/leaderboard"
            className="inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-transparent text-surface-400 hover:text-white text-sm font-mono transition-colors"
          >
            View main leaderboard
          </Link>
        </div>
        {error.digest && (
          <p className="text-[10px] font-mono text-surface-600">
            Error: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
