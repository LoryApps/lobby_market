'use client'

import Link from 'next/link'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function SourcesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-20 pb-24 md:pb-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="h-14 w-14 rounded-full bg-against-500/10 border border-against-500/20 flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6 text-against-400" aria-hidden />
        </div>
        <h2 className="font-mono text-lg font-semibold text-white mb-2">
          Failed to load Evidence Index
        </h2>
        <p className="text-sm font-mono text-surface-500 max-w-sm mb-6">
          {error.message || 'Something went wrong. Please try again.'}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 text-sm font-mono hover:text-white hover:border-surface-400 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Try again
          </button>
          <Link
            href="/arguments"
            className="px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-700 transition-colors"
          >
            Browse arguments
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
