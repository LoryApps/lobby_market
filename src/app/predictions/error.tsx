'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw, Target } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function PredictionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-24 pb-24 md:pb-12 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-against-500/10 border border-against-500/20 mb-6">
          <AlertTriangle className="h-8 w-8 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">
          Market data unavailable
        </h1>
        <p className="text-sm text-surface-500 mb-8 max-w-xs mx-auto">
          {error.message || 'Could not load prediction market data. Please try again.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white font-mono text-sm transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 border border-surface-300 text-white font-mono text-sm transition-colors"
          >
            <Target className="h-4 w-4" />
            Back to Feed
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
