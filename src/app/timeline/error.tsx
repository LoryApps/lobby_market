'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TimelineError({
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
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-16 pb-24 md:pb-12 flex flex-col items-center text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/20 mb-5">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">
          Timeline unavailable
        </h1>
        <p className="text-sm text-surface-500 font-mono mb-6 max-w-xs">
          Could not load the civic timeline right now. Try refreshing.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:border-surface-400 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/"
            className="text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            Back to Feed
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
