'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function MonthlyError({
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
    <div className="min-h-screen bg-surface-950 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-500/10 p-4 border border-red-500/20">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white">Digest Unavailable</h2>
          <p className="text-sm text-surface-400">
            We couldn&apos;t load the monthly digest. This may be a temporary issue.
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-for-600 hover:bg-for-500 px-5 py-2.5 text-sm font-medium text-white transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  )
}
