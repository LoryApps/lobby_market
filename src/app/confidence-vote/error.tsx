'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ConfidenceVoteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error('[ConfidenceVoteError]', error) }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto" />
        <h1 className="font-mono text-xl font-bold text-white">Failed to load confidence votes</h1>
        <p className="text-sm text-surface-500 font-mono">Something went wrong loading the chamber.</p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      </div>
    </div>
  )
}
