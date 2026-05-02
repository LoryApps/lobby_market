'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function LensError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[LensError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-against-400" />
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-surface-900">Lens unavailable</h2>
          <p className="text-sm text-surface-500">
            Couldn&apos;t load the Civic Lens dashboard. This is usually a temporary issue.
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-500/10 border border-for-500/30 text-for-400 text-sm font-medium hover:bg-for-500/20 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  )
}
