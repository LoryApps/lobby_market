'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function PredictionsLeaderboardError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30">
            <AlertTriangle className="h-5 w-5 text-against-400" />
          </div>
          <div>
            <p className="font-mono font-bold text-white">Failed to load</p>
            <p className="text-sm font-mono text-surface-500 mt-1">
              The predictions leaderboard could not be loaded.
            </p>
          </div>
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Leaderboard
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
