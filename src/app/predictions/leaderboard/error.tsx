'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function PredictionLeaderboardError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-24 flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400" />
        <h1 className="text-xl font-mono font-bold text-white">Failed to load leaderboard</h1>
        <p className="text-sm font-mono text-surface-500">Something went wrong. Please try again.</p>
        <Link
          href="/predictions"
          className="flex items-center gap-2 mt-2 px-4 py-2 rounded-lg bg-surface-200 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Predictions
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
