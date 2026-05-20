'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function MomentumError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-16 pb-24 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-against-500/10 border border-against-500/30">
            <AlertTriangle className="h-7 w-7 text-against-400" />
          </div>
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">
          Could not load momentum data
        </h1>
        <p className="text-sm font-mono text-surface-500 mb-6">
          Something went wrong while fetching the vote trend data.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-700 text-white text-sm font-mono transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
          <Link
            href=".."
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-white text-sm font-mono transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to topic
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
