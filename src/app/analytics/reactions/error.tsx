'use client'

import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-24 md:pb-12 flex flex-col items-center text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-950 border border-against-800 mb-4">
          <AlertCircle className="h-6 w-6 text-against-400" />
        </div>
        <h1 className="text-xl font-bold text-white font-mono mb-2">
          Failed to load reception analytics
        </h1>
        <p className="text-sm text-surface-500 mb-6 max-w-sm">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-surface-200 hover:bg-surface-300 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-2 rounded-lg border border-surface-300 hover:border-surface-400 px-4 py-2 text-sm font-medium text-surface-400 hover:text-white transition-colors"
          >
            Back to Analytics
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
