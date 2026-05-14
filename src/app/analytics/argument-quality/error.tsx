'use client'

import Link from 'next/link'
import { Brain, RefreshCw } from 'lucide-react'

export default function ArgumentQualityError({
  reset,
}: {
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-100 border border-surface-300 mx-auto">
          <Brain className="h-7 w-7 text-surface-400" />
        </div>
        <h2 className="text-white font-bold text-lg">Quality data unavailable</h2>
        <p className="text-surface-400 text-sm">
          Failed to load argument quality analytics. Try refreshing.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-medium hover:bg-for-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-100 border border-surface-300 text-white text-sm font-medium hover:bg-surface-200 transition-colors"
          >
            Analytics
          </Link>
        </div>
      </div>
    </div>
  )
}
