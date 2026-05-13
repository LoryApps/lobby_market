'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function PredictionAnalyticsError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-16 pb-24 flex flex-col items-center text-center">
        <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-against-500/10 border border-against-500/30 mb-4">
          <AlertTriangle className="h-8 w-8 text-against-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Could not load prediction analytics</h1>
        <p className="text-sm text-surface-500 mb-6 max-w-sm">
          Something went wrong while fetching your prediction data. Your predictions are safe.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-surface-700 hover:text-white hover:bg-surface-300 transition-colors text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/analytics"
            className="px-4 py-2 rounded-lg bg-for-600/20 text-for-400 hover:bg-for-600/30 transition-colors text-sm font-medium"
          >
            Back to Analytics
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
