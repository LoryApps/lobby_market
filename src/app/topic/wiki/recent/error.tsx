'use client'

import { FileEdit } from 'lucide-react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

export default function WikiRecentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-24 pb-24 md:pb-12 flex flex-col items-center text-center">
        <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-against-500/10 border border-against-500/30 mb-6">
          <FileEdit className="h-7 w-7 text-against-400" />
        </div>
        <h1 className="font-mono text-2xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="font-mono text-sm text-surface-500 mb-8 max-w-sm">
          {error.message ?? 'Failed to load recent wiki edits. Please try again.'}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className={cn(
              'px-4 py-2.5 rounded-xl text-sm font-mono font-medium',
              'bg-surface-200 text-surface-600 hover:bg-surface-300 hover:text-white',
              'border border-surface-300 transition-colors'
            )}
          >
            Try again
          </button>
          <Link
            href="/"
            className={cn(
              'px-4 py-2.5 rounded-xl text-sm font-mono font-medium',
              'bg-for-600/80 text-white hover:bg-for-600',
              'transition-colors'
            )}
          >
            Go home
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
