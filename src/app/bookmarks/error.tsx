'use client'

import Link from 'next/link'
import { Bookmark, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function BookmarksError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 flex items-center justify-center">
              <Bookmark className="h-6 w-6 text-surface-500" />
            </div>
          </div>
          <div>
            <p className="font-mono font-bold text-white text-lg">Couldn&apos;t load bookmarks</p>
            <p className="font-mono text-sm text-surface-500 mt-1">Something went wrong fetching your saved content.</p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white text-sm font-mono font-medium transition-colors"
            >
              Go home
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
