'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  const router = useRouter()

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-against-500/10 border border-against-500/30">
            <AlertTriangle className="h-8 w-8 text-against-400" />
          </div>
        </div>

        {/* Copy */}
        <div>
          <h1 className="font-mono text-2xl font-bold text-white mb-2">
            Something went wrong
          </h1>
          <p className="text-sm text-surface-500 font-mono leading-relaxed">
            An unexpected error occurred. This has been logged and we&apos;ll
            look into it.
          </p>
          {error.digest && (
            <p className="text-[11px] text-surface-600 font-mono mt-2">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 text-white text-sm font-mono font-medium hover:bg-for-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-white text-sm font-mono font-medium hover:bg-surface-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50"
          >
            <Home className="h-4 w-4" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  )
}
