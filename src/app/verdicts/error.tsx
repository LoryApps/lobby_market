'use client'

import { Gavel } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function VerdictsError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-16 pb-24 md:pb-12 flex flex-col items-center text-center gap-4">
        <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-against-500/10 border border-against-500/30">
          <Gavel className="h-6 w-6 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white">Something went wrong</h1>
        <p className="font-mono text-sm text-surface-500 max-w-xs">
          Could not load the verdicts feed. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:bg-surface-300 transition-colors"
        >
          Try again
        </button>
      </main>
      <BottomNav />
    </div>
  )
}
