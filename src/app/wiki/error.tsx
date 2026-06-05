'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { BookOpen, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function WikiError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[wiki]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-20 flex flex-col items-center gap-6 text-center">
        <div className="h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 flex items-center justify-center">
          <BookOpen className="h-7 w-7 text-against-400" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-mono font-bold text-white mb-2">Wiki portal unavailable</h1>
          <p className="text-sm font-mono text-surface-500 max-w-xs">
            Something went wrong loading the Civic Wiki. Try refreshing or browse topics directly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 text-white text-sm font-mono font-semibold hover:bg-for-500 transition-colors"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
          <Link
            href="/topics"
            className="px-4 py-2.5 rounded-xl border border-surface-300 text-surface-400 text-sm font-mono hover:border-surface-400 hover:text-white transition-colors"
          >
            Browse topics
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
