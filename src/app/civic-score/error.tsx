'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CivicScoreError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-24 flex flex-col items-center text-center gap-4">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
          <AlertTriangle className="h-7 w-7 text-against-400" />
        </div>
        <h1 className="text-lg font-mono font-bold text-white">Score unavailable</h1>
        <p className="text-sm text-surface-500 max-w-xs">
          Something went wrong loading your Civic Score. Please try again.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
          >
            Retry
          </button>
          <Link href="/" className="text-sm font-mono text-surface-500 hover:text-white transition-colors">
            Go home
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
