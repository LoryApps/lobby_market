'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default function TagArgumentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30 mx-auto mb-4">
          <AlertCircle className="h-6 w-6 text-against-400" />
        </div>
        <h2 className="font-mono text-lg font-bold text-white mb-2">Something went wrong</h2>
        <p className="font-mono text-sm text-surface-500 mb-6">{error.message}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 font-mono text-sm text-surface-300 hover:text-white transition-colors"
          >
            Try again
          </button>
          <Link
            href="/tags"
            className="px-4 py-2 rounded-lg bg-for-500/10 border border-for-500/30 font-mono text-sm text-for-400 hover:text-for-300 transition-colors"
          >
            Back to tags
          </Link>
        </div>
      </div>
    </div>
  )
}
