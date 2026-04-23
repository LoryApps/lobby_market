'use client'

import Link from 'next/link'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TranscriptError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-16 pb-28 md:pb-12 text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 mx-auto mb-4">
          <AlertCircle className="h-7 w-7 text-against-400" />
        </div>
        <h2 className="font-mono text-xl font-bold text-white mb-2">
          Transcript unavailable
        </h2>
        <p className="text-sm font-mono text-surface-500 mb-6">
          Could not load the debate transcript. The topic may be unavailable.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-white text-sm font-mono font-medium hover:bg-surface-300 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/trending"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600/10 border border-for-500/30 text-for-400 text-sm font-mono font-medium hover:bg-for-600/20 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Browse topics
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
