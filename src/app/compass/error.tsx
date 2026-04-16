'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CompassError({
  reset,
}: {
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-16 pb-28 md:pb-12 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-full bg-against-500/10 border border-against-500/30 mx-auto mb-5">
            <AlertTriangle className="h-7 w-7 text-against-400" />
          </div>
          <h2 className="font-mono text-2xl font-bold text-white mb-2">Compass Error</h2>
          <p className="text-surface-500 font-mono text-sm mb-6">
            Something went wrong loading your Civic Compass.
          </p>
          <div className="flex items-center gap-3 justify-center">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-white font-mono text-sm hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
            <Link
              href="/analytics"
              className="px-4 py-2 rounded-lg bg-purple/10 border border-purple/30 text-purple font-mono text-sm hover:bg-purple/20 transition-colors"
            >
              Go to Analytics
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
