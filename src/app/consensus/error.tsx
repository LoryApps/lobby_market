'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ConsensusError({
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
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-against-400 mx-auto" />
          <div>
            <h1 className="font-mono text-lg font-bold text-white mb-1">
              Consensus Engine Error
            </h1>
            <p className="text-sm font-mono text-surface-500">
              Failed to load the consensus visualization.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
            >
              Retry
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 text-sm font-mono hover:text-white transition-colors"
            >
              Go Home
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
