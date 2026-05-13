'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function SpotlightError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[spotlight]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/arguments"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-100 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <h1 className="text-lg font-semibold text-white">Argument Spotlight</h1>
        </div>
        <div className="rounded-2xl border border-against-500/20 bg-against-500/5 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-against-400 mx-auto mb-3" aria-hidden />
          <p className="text-sm font-mono text-against-300 mb-4">
            {error.message ?? 'Failed to load the spotlight'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Try again
            </button>
            <Link
              href="/arguments"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-100 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              All arguments
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
