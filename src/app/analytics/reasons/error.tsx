'use client'

import Link from 'next/link'
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ReasonsAnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-8 pb-24">
        <Link
          href="/analytics"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Analytics
        </Link>
        <div className="rounded-2xl bg-surface-100 border border-against-900 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-against-400 mx-auto mb-3" />
          <p className="font-mono text-sm font-semibold text-white mb-1">Could not load reasons analytics</p>
          <p className="font-mono text-xs text-surface-500 mb-5">{error.message}</p>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 text-white text-xs font-mono font-semibold hover:bg-for-700 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Try again
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
