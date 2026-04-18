'use client'

import Link from 'next/link'
import { AlertTriangle, Tag } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export default function CategoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 mx-auto">
          <AlertTriangle className="h-7 w-7 text-against-400" aria-hidden="true" />
        </div>
        <h1 className="font-mono text-lg font-bold text-white">Failed to load category</h1>
        <p className="text-sm font-mono text-surface-500">{error.message}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-mono font-medium',
              'bg-for-600 text-white hover:bg-for-500 transition-colors'
            )}
          >
            Try again
          </button>
          <Link
            href="/topic/categories"
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-mono font-medium',
              'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors'
            )}
          >
            <Tag className="h-3.5 w-3.5" aria-hidden="true" />
            All categories
          </Link>
        </div>
      </div>
    </div>
  )
}
