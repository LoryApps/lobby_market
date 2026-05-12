'use client'

import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TopicsAnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-mono text-2xl font-bold text-white">Topic Analytics</h1>
        </div>

        <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-8 flex flex-col items-center gap-4 text-center">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10">
            <AlertTriangle className="h-6 w-6 text-against-400" />
          </div>
          <div>
            <p className="font-mono font-semibold text-white">Something went wrong</p>
            <p className="text-sm font-mono text-surface-500 mt-1">{error.message ?? 'Failed to load analytics'}</p>
          </div>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-sm font-mono text-white transition-colors"
          >
            Try again
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
