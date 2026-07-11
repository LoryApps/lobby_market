'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CountdownError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Countdown]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <p className="text-white font-mono font-semibold">Something went wrong</p>
        <p className="text-surface-500 text-sm max-w-xs">
          Failed to load the civic countdown. Please try again.
        </p>
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </main>
      <BottomNav />
    </div>
  )
}
