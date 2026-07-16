'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'

export default function SmartMoneyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[smart-money error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4 text-center">
      <div className="h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/20 flex items-center justify-center mb-4">
        <AlertTriangle className="h-5 w-5 text-against-400" />
      </div>
      <h1 className="text-base font-bold text-white mb-1">Smart Money unavailable</h1>
      <p className="text-sm text-surface-500 mb-6 max-w-xs">
        Could not load trader intelligence data. This is usually temporary.
      </p>
      <div className="flex items-center gap-3">
        <Link
          href="/exchange"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Exchange
        </Link>
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600/20 border border-for-600/40 text-sm font-mono text-for-300 hover:text-white transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    </div>
  )
}
