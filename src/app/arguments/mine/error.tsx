'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function MyArgumentsError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-16 pb-28 flex flex-col items-center gap-4 text-center">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30">
          <AlertTriangle className="h-5 w-5 text-against-400" />
        </div>
        <h1 className="font-mono text-lg font-bold text-white">Something went wrong</h1>
        <p className="text-sm font-mono text-surface-500 max-w-xs">
          We couldn&apos;t load your argument stats. Please try again.
        </p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg text-sm font-mono bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white transition-colors"
          >
            Try again
          </button>
          <Link
            href="/arguments"
            className="px-4 py-2 rounded-lg text-sm font-mono bg-for-500/15 text-for-400 hover:bg-for-500/25 border border-for-500/30 transition-colors"
          >
            Browse Arguments
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
