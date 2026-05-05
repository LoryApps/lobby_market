'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CohortError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[cohort]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30 mx-auto mb-4">
          <AlertTriangle className="h-5 w-5 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-surface-500 mb-6 max-w-sm mx-auto">
          Your Civic Tribe couldn&apos;t be loaded. Your data is safe.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl bg-emerald/10 border border-emerald/30 text-emerald text-sm font-mono font-semibold hover:bg-emerald/20 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 text-sm font-mono font-semibold hover:bg-surface-300 transition-colors"
          >
            Back to feed
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
