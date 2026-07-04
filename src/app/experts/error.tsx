'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ExpertsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('ExpertsPage error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex flex-col items-center justify-center py-28 gap-4 text-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
            <AlertTriangle className="h-6 w-6 text-against-400" />
          </div>
          <div className="space-y-1.5">
            <p className="font-mono font-bold text-white text-lg">Could not load experts</p>
            <p className="font-mono text-sm text-surface-500 max-w-xs">
              Something went wrong fetching the expert directory. Try again or come back later.
            </p>
          </div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
            <Link
              href="/questions"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 text-sm font-mono font-medium transition-colors"
            >
              Go to Q&amp;A
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
