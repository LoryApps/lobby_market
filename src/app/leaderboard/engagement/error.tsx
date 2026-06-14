'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PageError } from '@/components/ui/PageError'

export default function EngagementLeaderboardError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/leaderboard"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-mono text-xl font-bold text-white">Engagement Index</h1>
        </div>
        <PageError message={error.message} onRetry={reset} />
      </main>
      <BottomNav />
    </div>
  )
}
