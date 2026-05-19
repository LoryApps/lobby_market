'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function RecoilError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-8 text-center max-w-sm w-full">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-3" aria-hidden />
        <h2 className="font-mono text-base font-bold text-white mb-1">Something went wrong</h2>
        <p className="font-mono text-xs text-surface-500 mb-5">
          Could not load the Civic Recoil tracker. Please try again.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-300 text-white text-xs font-mono font-semibold hover:bg-surface-400 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600 text-white text-xs font-mono font-semibold hover:bg-for-700 transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
