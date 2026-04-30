'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'

export default function MatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center gap-4 px-4">
      <p className="text-surface-500 font-mono text-sm text-center">
        Something went wrong loading Civic Match.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm hover:bg-for-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
        <Link
          href="/arcade"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-surface-700 text-sm hover:bg-surface-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Arcade
        </Link>
      </div>
    </div>
  )
}
