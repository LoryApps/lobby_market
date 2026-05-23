'use client'

import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function MomentumError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-28 text-center">
        <p className="text-4xl mb-4">📉</p>
        <h1 className="font-mono text-xl font-bold text-white mb-2">Failed to load</h1>
        <p className="text-sm font-mono text-surface-500 mb-6">
          Couldn&apos;t fetch your momentum data. Try again.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-500/10 border border-for-500/30 text-sm font-mono text-for-400 hover:bg-for-500/20 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Analytics
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
