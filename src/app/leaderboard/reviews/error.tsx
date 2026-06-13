'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ReviewLeaderboardError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="font-mono text-xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="font-mono text-sm text-surface-500 mb-6">
          The reviews leaderboard couldn&apos;t load. Please try again.
        </p>
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 text-white font-mono text-sm hover:bg-surface-300 transition-colors"
        >
          Back to Leaderboard
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
