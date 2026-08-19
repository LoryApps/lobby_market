'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function ThesisNetworkError({
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
      <AlertTriangle className="h-8 w-8 text-against-400" />
      <h2 className="text-lg font-mono text-white">Network graph failed to load</h2>
      <p className="text-sm font-mono text-surface-500 text-center">
        The thesis network could not be built. Try refreshing or return to the thesis board.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-surface-200 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/thesis"
          className="px-4 py-2 rounded-lg bg-surface-300 text-sm font-mono text-white hover:bg-surface-400 transition-colors"
        >
          Back to Thesis
        </Link>
      </div>
    </div>
  )
}
