'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function PolarizationError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <AlertTriangle className="h-10 w-10 text-against-400" />
        <h1 className="font-mono text-lg font-bold text-white">Failed to load Polarization Index</h1>
        <p className="font-mono text-sm text-surface-500 text-center max-w-sm">
          The polarization calculation encountered an error. Try refreshing the page.
        </p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-for-600/30 text-for-300 font-mono text-sm border border-for-500/30 hover:bg-for-600/40 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/stats"
            className="px-4 py-2 rounded-lg bg-surface-200 text-surface-400 font-mono text-sm border border-surface-300 hover:text-white transition-colors"
          >
            Back to Stats
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
