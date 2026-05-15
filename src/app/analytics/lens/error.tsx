'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LensAnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-against-400 mx-auto mb-4" />
        <h2 className="font-mono text-lg font-semibold text-white mb-2">
          Couldn&apos;t load perspective lens
        </h2>
        <p className="text-sm font-mono text-surface-500 mb-6">
          {error.message ?? 'Something went wrong. Please try again.'}
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="text-sm font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            Try again
          </button>
          <Link href="/analytics" className="text-sm font-mono text-surface-500 hover:text-white transition-colors">
            Back to Analytics
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
