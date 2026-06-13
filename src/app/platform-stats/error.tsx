'use client'

import { useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function PlatformStatsError({
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
      <main className="max-w-5xl mx-auto px-4 pt-20 pb-28 md:pb-12 flex flex-col items-center justify-center gap-4 text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
          <AlertTriangle className="h-7 w-7 text-against-400" />
        </div>
        <h2 className="font-mono text-xl font-bold text-white">Failed to load stats</h2>
        <p className="text-sm font-mono text-surface-500 max-w-xs">{error.message}</p>
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-500/10 border border-for-500/30 text-for-400 font-mono text-sm hover:bg-for-500/20 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </main>
      <BottomNav />
    </div>
  )
}
