'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function PositionsMapError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-16 pb-24 md:pb-16 flex flex-col items-center text-center gap-6">
        <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-against-500/10 border border-against-500/30">
          <AlertTriangle className="h-7 w-7 text-against-400" />
        </div>

        <div>
          <h1 className="font-mono text-xl font-bold text-white mb-2">Map failed to load</h1>
          <p className="text-sm font-mono text-surface-500 max-w-sm">
            {error.message || 'Something went wrong while building your civic map. Please try again.'}
          </p>
        </div>

        <button
          onClick={reset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:bg-surface-300 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </main>
      <BottomNav />
    </div>
  )
}
