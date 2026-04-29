'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'

export default function ClozeError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="h-8 w-8 text-against-400 mb-3" />
      <p className="text-sm font-mono text-surface-500 mb-4">
        Could not load today&apos;s Cloze puzzle. Try again or come back later.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 bg-surface-200 border border-surface-300 rounded-xl text-sm font-mono text-white hover:bg-surface-300 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
        <Link
          href="/arcade"
          className="flex items-center gap-2 px-4 py-2 bg-surface-200 border border-surface-300 rounded-xl text-sm font-mono text-white hover:bg-surface-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Arcade
        </Link>
      </div>
    </div>
  )
}
