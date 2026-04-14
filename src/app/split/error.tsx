'use client'

import Link from 'next/link'
import { GitFork, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'

export default function SplitError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-28 md:pb-12 flex flex-col items-center text-center">
        <div className="h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-5">
          <GitFork className="h-6 w-6 text-surface-500" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">
          Failed to load The Split
        </h1>
        <p className="text-sm font-mono text-surface-500 max-w-xs mb-6">
          Could not fetch contested topics. The Lobby may be temporarily
          unavailable.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="for" size="sm" onClick={reset}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Try again
          </Button>
          <Link
            href="/"
            className="text-sm font-mono text-surface-500 hover:text-surface-700 transition-colors"
          >
            Go home
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
