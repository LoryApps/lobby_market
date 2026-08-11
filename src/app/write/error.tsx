'use client'

import { useEffect } from 'react'

export default function WriteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[write page error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-surface-200 text-sm">Something went wrong loading the composer.</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-gold text-surface-900 rounded-lg text-sm font-medium hover:bg-gold/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
