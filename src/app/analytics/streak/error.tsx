'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function StreakAnalyticsError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-12 pb-24 md:pb-12 flex flex-col items-center text-center">
        <div className="h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 flex items-center justify-center mb-4">
          <AlertTriangle className="h-7 w-7 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">Couldn&apos;t load streak data</h1>
        <p className="text-sm text-surface-500 mb-6 max-w-xs">
          There was a problem fetching your streak history. Try again or head back to the analytics hub.
        </p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-700 text-white text-sm font-mono font-medium transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/analytics"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-300 text-surface-500 hover:text-white text-sm font-mono transition-colors"
          >
            Analytics Hub
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
