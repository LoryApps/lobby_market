'use client'

import { useEffect } from 'react'
import { RefreshCw, Scale } from 'lucide-react'

export default function LegacyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[/legacy]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/20 mx-auto mb-5">
          <Scale className="h-6 w-6 text-against-400" />
        </div>
        <h2 className="text-lg font-black text-white mb-2">Couldn&apos;t load legacy</h2>
        <p className="text-sm text-surface-500 mb-6 leading-relaxed">
          Something went wrong loading your civic record. Your legacy is safe — try again.
        </p>
        <button
          onClick={reset}
          className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-for-500 text-white text-sm font-mono hover:bg-for-600 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  )
}
