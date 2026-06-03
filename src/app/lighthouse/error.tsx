'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Lightbulb, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LighthouseError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[lighthouse error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-20 pb-24 text-center">
        <div className="h-14 w-14 rounded-2xl bg-surface-100 border border-surface-300 flex items-center justify-center mx-auto mb-4">
          <Lightbulb className="h-6 w-6 text-surface-500" />
        </div>
        <h1 className="font-mono text-lg font-bold text-white mb-2">The lighthouse went dark</h1>
        <p className="text-sm font-mono text-surface-500 mb-6">
          {error.message ?? 'Something went wrong loading the Civic Lighthouse.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600/80 border border-for-500/40 text-white text-xs font-mono hover:bg-for-500 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to feed
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
