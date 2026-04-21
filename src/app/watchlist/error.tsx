'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function WatchlistError({ error, reset }: ErrorProps) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-20 pb-28 md:pb-20 flex flex-col items-center text-center gap-6">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
          <AlertTriangle className="h-6 w-6 text-against-400" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="font-mono text-xl font-bold text-white">Watchlist unavailable</h1>
          <p className="text-sm text-surface-500 max-w-sm">
            {error.message ?? 'Could not load your followed topics. Please try again.'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded-xl bg-for-600/20 border border-for-600/40 text-for-400 text-sm font-mono hover:bg-for-600/30 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 text-sm font-mono hover:bg-surface-300 transition-colors"
          >
            Go home
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
