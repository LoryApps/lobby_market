'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertTriangle className="h-8 w-8 text-against-400 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-white mb-1">Something went wrong</h2>
          <p className="text-sm text-surface-500 mb-4">
            Failed to load your Command Center. Please try again.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-semibold transition-colors"
            >
              Retry
            </button>
            <Link
              href="/exchange"
              className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm text-surface-300 hover:text-white transition-colors"
            >
              Back to Exchange
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
