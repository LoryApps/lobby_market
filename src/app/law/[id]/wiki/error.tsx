'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LawWikiError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[law-wiki] error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-20 pb-24 md:pb-12 flex flex-col items-center justify-center text-center gap-5">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <div className="space-y-1.5 max-w-xs">
          <p className="font-mono font-bold text-white text-lg">Something went wrong</p>
          <p className="font-mono text-sm text-surface-500 leading-relaxed">
            Failed to load the law wiki. Try again or return to the law.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white text-sm font-mono transition-colors"
          >
            Try again
          </button>
          <Link
            href="/laws"
            className="px-4 py-2 rounded-lg bg-gold/20 border border-gold/40 text-gold text-sm font-mono font-medium transition-colors hover:bg-gold/30"
          >
            Browse laws
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
