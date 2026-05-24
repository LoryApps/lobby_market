'use client'

import Link from 'next/link'
import { BookOpen, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

export default function TopicIndexError({
  error: _error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30 mx-auto mb-4">
          <BookOpen className="h-6 w-6 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">
          Index unavailable
        </h1>
        <p className="text-sm text-surface-500 mb-6 max-w-sm mx-auto">
          The topic index couldn&rsquo;t be loaded. This is likely a temporary issue.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-mono font-semibold',
              'bg-for-600 text-white hover:bg-for-500 transition-colors',
            )}
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/topics"
            className="px-4 py-2 rounded-lg text-sm font-mono text-surface-400 hover:text-white bg-surface-200 hover:bg-surface-300 transition-colors"
          >
            Browse topics
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
