'use client'

import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'

export default function LawFramesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4 text-center">
      <p className="text-surface-500 mb-4">
        {error.message ?? 'Something went wrong loading ideological frames.'}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-surface-600 hover:bg-surface-300 hover:text-white transition-colors text-sm font-mono"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
        <Link
          href=".."
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-surface-600 hover:bg-surface-300 hover:text-white transition-colors text-sm font-mono"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to law
        </Link>
      </div>
    </div>
  )
}
