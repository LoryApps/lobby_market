'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LawTimelineError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-16 pb-24 flex flex-col items-center text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 mb-5">
          <AlertTriangle className="h-7 w-7 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">
          Timeline unavailable
        </h1>
        <p className="text-sm text-surface-500 max-w-xs leading-relaxed mb-6">
          Could not load the Codex timeline. Check your connection and try again.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded-xl bg-for-600 hover:bg-for-700 text-white text-sm font-mono font-medium transition-colors"
          >
            Try again
          </button>
          <Link
            href="/law"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 text-white text-sm font-mono transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Codex
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
