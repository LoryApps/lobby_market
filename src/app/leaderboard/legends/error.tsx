'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LegendsError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  useEffect(() => {
    console.error('Legends error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-16 pb-24 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <p className="font-mono text-white text-lg mb-2">Failed to load Legends</p>
        <p className="font-mono text-surface-500 text-sm mb-6">
          {error.message || 'Something went wrong loading the Hall of Legends.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono transition-colors"
          >
            Try again
          </button>
          <Link
            href="/leaderboard"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white text-sm font-mono transition-colors"
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
