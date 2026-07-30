'use client'

import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'

export default function LawDissentError({
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
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
        <AlertTriangle className="h-10 w-10 text-against-400" />
        <h2 className="font-mono text-lg font-bold text-white">Something went wrong</h2>
        <p className="text-sm font-mono text-surface-500">
          Could not load the dissent data for this law.
        </p>
        <button
          onClick={reset}
          className="h-9 px-4 rounded-lg bg-surface-200 hover:bg-surface-300 text-sm font-mono text-white transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
