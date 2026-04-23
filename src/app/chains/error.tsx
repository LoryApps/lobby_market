'use client'

import { GitFork, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ChainsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-16 pb-24 md:pb-12 flex flex-col items-center text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-100 border border-surface-300 mb-5">
          <GitFork className="h-6 w-6 text-surface-500" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">
          Couldn&apos;t load chains
        </h1>
        <p className="text-sm font-mono text-surface-500 mb-6 max-w-sm">
          {error.message || 'Something went wrong loading topic chains. Please try again.'}
        </p>
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-100 border border-surface-300 hover:border-purple/40 text-sm font-mono text-surface-400 hover:text-white transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </main>
      <BottomNav />
    </div>
  )
}
