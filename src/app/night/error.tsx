'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function NightError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Night page error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28 md:pb-12 flex flex-col items-center text-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-gold" />
        </div>
        <div className="space-y-1.5 max-w-xs">
          <p className="font-mono font-bold text-white text-lg">Night brief unavailable</p>
          <p className="font-mono text-surface-500 text-sm">
            Something went wrong loading tonight's brief. Try refreshing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white text-sm font-mono transition-colors"
          >
            Go home
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
