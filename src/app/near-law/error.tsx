'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function NearLawError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  useEffect(() => {
    console.error('[NearLaw]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-20 pb-24 md:pb-12 flex flex-col items-center text-center gap-4">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
          <AlertCircle className="h-7 w-7 text-against-400" />
        </div>
        <h1 className="font-mono text-2xl font-bold text-white">Something went wrong</h1>
        <p className="text-sm text-surface-500 max-w-xs">
          Could not load the Near Law feed. The chamber may be temporarily unavailable.
        </p>
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-for-500/10 border border-for-500/30 text-for-400 text-sm font-mono font-semibold hover:bg-for-500/20 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 text-sm font-mono hover:text-white transition-colors"
          >
            Go home
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
