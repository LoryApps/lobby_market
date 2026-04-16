'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function WikiHistoryError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-20 flex flex-col items-center text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mb-4" />
        <h1 className="text-lg font-bold text-white mb-2">History unavailable</h1>
        <p className="text-sm text-surface-500 mb-6">
          We couldn&apos;t load the edit history. Please try again.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
          >
            Retry
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg border border-surface-300 text-surface-400 text-sm font-mono hover:text-white transition-colors"
          >
            Go home
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
