'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function MatrixError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-28 md:pb-12 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Civic Matrix unavailable</h1>
        <p className="text-sm font-mono text-surface-500 mb-6 max-w-sm mx-auto">
          {error.message ?? 'Something went wrong loading the category correlation matrix.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg text-sm font-mono font-semibold bg-for-600 hover:bg-for-700 text-white transition-colors"
          >
            Try again
          </button>
          <Link
            href="/correlations"
            className="px-4 py-2 rounded-lg text-sm font-mono font-semibold bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-all"
          >
            Topic Correlations
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
