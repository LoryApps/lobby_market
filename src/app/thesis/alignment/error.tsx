'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function ThesisAlignmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col items-center justify-center gap-4 px-4">
      <AlertTriangle className="w-10 h-10 text-against-400" />
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-surface-400 text-center max-w-xs">{error.message || 'Failed to load thesis alignment.'}</p>
      <div className="flex gap-3 mt-2">
        <button
          onClick={reset}
          className="text-sm px-4 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/thesis"
          className="text-sm px-4 py-2 rounded-lg bg-for-600/20 text-for-400 hover:bg-for-600/30 transition-colors"
        >
          Back to Theses
        </Link>
      </div>
    </div>
  )
}
