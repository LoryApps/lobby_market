'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[civic-commons error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-950 gap-4 px-4 text-center">
      <AlertTriangle className="h-8 w-8 text-against-400" />
      <h1 className="text-lg font-bold font-mono text-white">Civic Commons unavailable</h1>
      <p className="text-sm font-mono text-surface-500 max-w-xs">
        Something went wrong loading governance data.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white text-sm font-mono font-semibold transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
