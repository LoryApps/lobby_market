'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-24 pb-24 text-center space-y-6">
        <div className="h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/20 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-7 w-7 text-against-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">Something went wrong</h1>
          <p className="text-surface-500 text-sm">Failed to load voting-phase topics.</p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-white text-sm font-medium hover:bg-surface-300 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/near-law"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-surface-500 text-sm hover:text-white transition-colors"
          >
            Near Law
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
