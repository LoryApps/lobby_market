'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ThesisLeaderboardError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-16 pb-24 md:pb-12 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-surface-500 text-sm mb-6">
          The thesis leaderboard could not be loaded. Please try again.
        </p>
        <Link
          href="/thesis"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-surface-200 hover:bg-surface-300 text-white transition-colors"
        >
          Back to Thesis Board
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
