'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function PipelineError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-16 pb-24 text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-against-500/10 border border-against-500/30 mx-auto mb-4">
          <AlertTriangle className="h-7 w-7 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">
          Pipeline Unavailable
        </h1>
        <p className="text-sm font-mono text-surface-500 mb-6">
          Could not load the legislation pipeline. Please try again.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 text-sm font-mono hover:bg-surface-300 hover:text-white transition-colors"
          >
            Go home
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
