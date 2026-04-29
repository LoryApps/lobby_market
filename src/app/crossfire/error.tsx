'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CrossfireError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20 text-center gap-4">
        <div className="h-12 w-12 rounded-full bg-against-500/10 border border-against-500/20 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <div>
          <h2 className="text-base font-bold font-mono text-surface-100 mb-1">
            Battle interrupted
          </h2>
          <p className="text-sm font-mono text-surface-500">
            Something went wrong loading The Crossfire.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-400 text-sm font-mono text-surface-200 hover:bg-surface-300 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
          <Link
            href="/"
            className="text-sm font-mono text-surface-500 hover:text-surface-200 transition-colors"
          >
            Go home
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
