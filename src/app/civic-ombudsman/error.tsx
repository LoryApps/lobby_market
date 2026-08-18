'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'

export default function OmbudsmanError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error('[OmbudsmanError]', error) }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
            <AlertTriangle className="h-7 w-7 text-against-400" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="font-mono text-lg font-bold text-white">Something went wrong</h1>
          <p className="text-sm text-surface-400">The Civic Ombudsman page failed to load.</p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold text-white bg-against-600/80 hover:bg-against-600 border border-against-500/50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono text-surface-400 hover:text-white bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
