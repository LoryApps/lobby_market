'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Calendar, AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function DigestError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[DigestPage]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-16 pb-24 md:pb-12 flex flex-col items-center text-center gap-5">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-950 border border-against-800">
          <AlertTriangle className="h-7 w-7 text-against-400" />
        </div>
        <div>
          <p className="font-mono font-bold text-white text-lg">
            Failed to load the Weekly Digest
          </p>
          <p className="text-sm text-surface-500 mt-1">
            {error.message ?? 'Something went wrong. Please try again.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
          >
            <Calendar className="h-4 w-4" />
            Back to Feed
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
