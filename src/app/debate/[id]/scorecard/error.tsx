'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ScorecardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-28 flex flex-col items-center gap-4 text-center">
        <AlertCircle className="h-8 w-8 text-against-400" />
        <p className="text-sm font-mono text-white">Could not load scorecard</p>
        <p className="text-xs text-surface-500">{error.message}</p>
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={reset}
            className="text-xs font-mono text-surface-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-surface-300 hover:border-surface-400"
          >
            Try again
          </button>
          <Link
            href="."
            className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            Debate Hub
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
