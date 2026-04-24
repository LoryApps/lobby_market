'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function SignalsError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <AlertTriangle className="h-10 w-10 text-against-400" aria-hidden="true" />
      <div>
        <p className="text-white font-semibold mb-1">Failed to load signals</p>
        <p className="text-sm text-surface-500 font-mono">Something went wrong fetching platform data.</p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
      >
        <RefreshCw className="h-3 w-3" aria-hidden="true" />
        Try again
      </button>
    </div>
  )
}
