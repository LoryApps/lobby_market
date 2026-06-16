'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CoalitionMembersError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Coalition members error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-24 flex flex-col items-center gap-5 text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/20">
          <AlertCircle className="h-7 w-7 text-against-400" />
        </div>
        <div>
          <h2 className="font-mono text-lg font-bold text-white mb-2">Failed to load members</h2>
          <p className="text-sm text-surface-400 max-w-xs">
            Something went wrong loading the Coalition Member Directory. Try refreshing or going back.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-100 border border-surface-300 text-sm font-mono font-semibold text-white hover:bg-surface-200 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/coalitions"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono font-semibold text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All coalitions
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
