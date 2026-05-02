'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Scale, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CrossroadsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[CrossroadsError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 mx-auto">
            <Scale className="h-7 w-7 text-against-400" />
          </div>
          <h2 className="font-mono text-lg font-bold text-white">
            Crossroads Unavailable
          </h2>
          <p className="text-sm font-mono text-surface-400">
            The dilemma failed to load. The civic scales need recalibrating.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={reset}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-surface-300 text-sm font-mono hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
            <Link
              href="/"
              className="text-xs font-mono text-surface-500 hover:text-surface-400 transition-colors"
            >
              Return to feed
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
