'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'

export default function LawCounselError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams()
  const lawId = params?.id as string | undefined

  useEffect(() => {
    console.error('[LawCounsel] Error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-900 px-4 text-center">
      <div className="max-w-md space-y-4">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-white">Counsel Unavailable</h1>
          <p className="text-sm text-surface-400">
            The Law Counsel encountered an error. This may be a temporary issue — try again or return to the law.
          </p>
          {error.digest && (
            <p className="text-xs text-surface-600 font-mono">Error: {error.digest}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gold/10 border border-gold/30 text-gold text-sm font-medium hover:bg-gold/20 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </button>
          {lawId && (
            <Link
              href={`/law/${lawId}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-surface-700/50 border border-surface-600/50 text-surface-300 text-sm font-medium hover:bg-surface-700 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Law
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
