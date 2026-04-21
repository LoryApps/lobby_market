'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Globe, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LawAtlasError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[LawAtlas]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 py-24 text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 mx-auto mb-4">
          <Globe className="h-6 w-6 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">Atlas unavailable</h1>
        <p className="text-sm font-mono text-surface-500 mb-6">
          Could not load law data. Please try again.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono font-medium hover:bg-for-500 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
          <Link
            href="/law"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 text-sm font-mono font-medium hover:text-white transition-colors"
          >
            Back to Codex
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
