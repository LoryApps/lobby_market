'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Globe, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function DiscoverError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-200 border border-surface-300">
            <Globe className="h-6 w-6 text-surface-500" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <p className="font-mono font-bold text-white text-lg">Something went wrong</p>
            <p className="text-sm font-mono text-surface-500 max-w-xs">
              The Discover page failed to load. Try refreshing or head back to the feed.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white text-sm font-mono font-medium transition-colors"
            >
              Back to feed
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
