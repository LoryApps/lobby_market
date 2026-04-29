'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function MyDebateRecordError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-12 pb-24 md:pb-12">
        <div className="rounded-2xl border border-against-500/30 bg-surface-100 p-8 text-center">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-against-500/10 text-against-400 mx-auto mb-4">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="font-mono text-lg font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-sm text-surface-500 font-mono mb-6">
            Could not load your debate record.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
            >
              Try again
            </button>
            <Link
              href="/debate"
              className="px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-white text-sm font-mono transition-colors"
            >
              Back to Debates
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
