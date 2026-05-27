'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function FuturesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-against-400 mx-auto" />
        <h2 className="text-lg font-mono font-bold text-white">Futures board unavailable</h2>
        <p className="text-sm text-surface-500 font-mono">Something went wrong loading upcoming events.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-surface-200 border border-surface-300 rounded-lg text-xs font-mono text-white hover:border-surface-400 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-for-600 rounded-lg text-xs font-mono text-white hover:bg-for-500 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
