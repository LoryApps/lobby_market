'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ArchetypeIntelligenceError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-24 md:pb-12 flex flex-col items-center text-center gap-4">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white">Intelligence unavailable</h1>
        <p className="text-sm font-mono text-surface-500 max-w-sm">
          {error.message || 'Something went wrong loading the archetype analysis.'}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl bg-for-600 hover:bg-for-700 text-white text-sm font-mono font-semibold transition-colors"
          >
            Try again
          </button>
          <Link
            href="/archetype"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-400 text-sm font-mono transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
