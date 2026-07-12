'use client'

import Link from 'next/link'
import { RefreshCw, ScrollText } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function OrderPaperError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 flex items-center justify-center px-4 pb-24">
        <div className="text-center max-w-sm">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 mx-auto mb-4">
            <ScrollText className="h-6 w-6 text-surface-500" />
          </div>
          <h1 className="text-lg font-semibold text-surface-800 mb-2">
            Order Paper Unavailable
          </h1>
          <p className="text-sm text-surface-500 mb-6">
            The Order Paper could not be loaded. Please try again.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-sm text-surface-700 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-sm text-white transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
