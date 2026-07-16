'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function NewsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Exchange/News]', error)
  }, [error])

  return (
    <div className="min-h-[40vh] flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-xs">
        <div className="flex justify-center">
          <div className="p-3 rounded-2xl bg-against-500/10 border border-against-500/30">
            <AlertTriangle className="h-6 w-6 text-against-400" />
          </div>
        </div>
        <div>
          <p className="font-mono text-sm font-semibold text-white">Failed to load market news</p>
          <p className="text-xs text-surface-500 font-mono mt-1">
            {error.message || 'An unexpected error occurred.'}
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 text-white text-xs font-mono font-medium hover:bg-for-500 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    </div>
  )
}
