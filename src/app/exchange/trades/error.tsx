'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TradesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />
      <div className="max-w-2xl mx-auto px-4 pt-24 flex flex-col items-center text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-1">Trades unavailable</h2>
        <p className="text-sm text-surface-500 mb-6">
          {error.message || 'Could not load the live trades feed.'}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-300 hover:bg-surface-400 text-sm font-mono text-white transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
      <BottomNav />
    </div>
  )
}
