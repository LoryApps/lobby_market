'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CoalitionLeaderboardError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mb-4" aria-hidden />
        <h1 className="font-mono text-xl font-bold text-white mb-2">Could not load standings</h1>
        <p className="font-mono text-sm text-surface-500 mb-6 max-w-sm">
          Something went wrong fetching coalition data. Please try again.
        </p>
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:bg-surface-300 text-sm font-mono transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Leaderboard
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
