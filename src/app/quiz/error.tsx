'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function QuizError() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4">
      <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-against-500/10 border border-against-500/30 mb-4">
        <AlertTriangle className="h-8 w-8 text-against-400" />
      </div>
      <h2 className="font-mono text-xl font-bold text-white mb-2">Quiz unavailable</h2>
      <p className="font-mono text-sm text-surface-500 mb-6 text-center max-w-xs">
        We couldn&rsquo;t load quiz topics right now. Try again or explore the feed.
      </p>
      <div className="flex gap-3">
        <Link
          href="/quiz"
          className="px-5 py-2.5 rounded-xl bg-for-600 border border-for-500/50 font-mono text-sm font-semibold text-white hover:bg-for-500 transition-colors"
        >
          Try again
        </Link>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl border border-surface-300 font-mono text-sm text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
        >
          Back to feed
        </Link>
      </div>
    </div>
  )
}
