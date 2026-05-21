'use client'

import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ProposalsAnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4 text-surface-600" />
          </Link>
          <h1 className="font-mono text-xl font-bold text-white">Proposal Analytics</h1>
        </div>

        <div className="rounded-2xl border border-against-500/30 bg-against-500/10 p-8 text-center space-y-4">
          <AlertTriangle className="h-8 w-8 text-against-400 mx-auto" />
          <p className="text-against-400 font-mono text-sm">
            {error.message ?? 'Failed to load proposal analytics'}
          </p>
          <button
            onClick={reset}
            className="text-xs font-mono text-surface-400 hover:text-white transition-colors border border-surface-400/40 rounded-lg px-4 py-2"
          >
            Try again
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
