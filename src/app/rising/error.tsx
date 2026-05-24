'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function RisingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[/rising]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-24 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="font-mono text-xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-sm font-mono text-surface-500 mb-6">
          Could not load the Rising Citizens page.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-for-500/10 border border-for-500/30 text-sm font-mono font-semibold text-for-400 hover:bg-for-500/20 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
