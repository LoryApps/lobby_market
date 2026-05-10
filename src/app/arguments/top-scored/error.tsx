'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TopScoredError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-20 flex flex-col items-center gap-4 text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <h1 className="text-lg font-mono font-bold text-white">Couldn&apos;t load top-scored arguments</h1>
        <p className="text-sm font-mono text-surface-500 max-w-sm">
          Something went wrong while fetching the quality ranking. Try refreshing — the Argument Coach AI will be back shortly.
        </p>
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
          <Link
            href="/arguments"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white text-sm font-mono transition-colors"
          >
            Back to Arguments
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
