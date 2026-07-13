'use client'

import Link from 'next/link'
import { BookOpen, RefreshCw } from 'lucide-react'

export default function HansardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center gap-4 p-8">
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300">
        <BookOpen className="h-6 w-6 text-surface-500" />
      </div>
      <div className="text-center max-w-sm">
        <h2 className="font-mono text-lg font-bold text-white mb-2">Record unavailable</h2>
        <p className="text-sm text-surface-400">
          {error.message || 'The Hansard could not be loaded at this time.'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-white text-sm font-mono transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
        <Link
          href="/parliament"
          className="px-4 py-2 rounded-xl border border-surface-300/60 text-surface-400 hover:text-white text-sm font-mono transition-colors"
        >
          Back to Parliament
        </Link>
      </div>
    </div>
  )
}
