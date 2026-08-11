'use client'

import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function HoroscopeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-xl mx-auto px-4 pt-12 pb-24 flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-8 w-8 text-against-400" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-white">Reading unavailable</h2>
          <p className="text-xs text-surface-500 mt-1">{error.message || 'Your horoscope could not be cast right now.'}</p>
        </div>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-surface-300/60 text-xs text-white hover:bg-surface-400/60 transition-colors"
        >
          Try again
        </button>
      </main>
      <BottomNav />
    </div>
  )
}
