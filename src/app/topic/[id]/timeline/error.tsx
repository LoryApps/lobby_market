'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TopicTimelineError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-16 pb-24 md:pb-12 text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-full bg-against-500/10 border border-against-500/30 mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">Timeline unavailable</h1>
        <p className="text-sm font-mono text-surface-500 mb-6">
          Could not load the topic history.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono font-medium hover:bg-for-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <Link
            href="/topic/graph"
            className="px-4 py-2 rounded-lg border border-surface-300 text-surface-500 text-sm font-mono hover:text-white hover:border-surface-400 transition-colors"
          >
            Browse Topics
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
