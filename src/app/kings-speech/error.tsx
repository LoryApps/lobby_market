'use client'

import { Crown, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function KingsSpeechError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex items-center justify-center pb-24 px-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-7 h-7 text-gold/60" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Parliament Unavailable</h2>
          <p className="text-sm text-surface-400 mb-5">
            The King&apos;s Speech could not be loaded at this time. Please try again.
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/15 border border-gold/30 text-gold text-sm font-semibold hover:bg-gold/25 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
