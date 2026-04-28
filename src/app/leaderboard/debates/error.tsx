'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function DebatesLeaderboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-16 pb-24 md:pb-12 flex flex-col items-center text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 mb-4">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">
          Debate rankings unavailable
        </h1>
        <p className="text-sm font-mono text-surface-500 max-w-sm mb-6">
          {error.message || 'Something went wrong loading the debate hall of fame.'}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple/80 hover:bg-purple text-white text-sm font-mono font-semibold transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-white text-sm font-mono font-semibold transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
