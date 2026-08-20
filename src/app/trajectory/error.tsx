'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TrajectoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Trajectory unavailable</h2>
        <p className="text-sm text-surface-500 mb-6">Something went wrong loading the trajectory data.</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm text-white hover:bg-surface-300 transition-colors"
        >
          Try again
        </button>
      </main>
      <BottomNav />
    </div>
  )
}
