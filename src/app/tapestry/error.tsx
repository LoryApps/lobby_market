'use client'

import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'

export default function TapestryError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <p className="font-mono text-against-400 text-sm">Failed to load the tapestry.</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
          <Link
            href="/laws"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to laws
          </Link>
        </div>
      </div>
    </div>
  )
}
