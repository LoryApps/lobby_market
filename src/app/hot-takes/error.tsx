'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function HotTakesError({
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
    <div className="flex flex-col h-screen bg-surface-100">
      <TopBar />
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-against-400 mx-auto" />
          <p className="text-surface-500 text-sm">Failed to load hot takes</p>
          <button
            onClick={reset}
            className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-surface-200 text-surface-700 text-sm hover:bg-surface-300 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
