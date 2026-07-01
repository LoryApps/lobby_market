'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function OppositionError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('OppositionError:', error)
  }, [error])

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center gap-5 px-4 pb-24">
        <AlertTriangle className="h-10 w-10 text-against-400" />
        <div className="text-center space-y-1">
          <h2 className="text-base font-semibold text-white">Failed to load opposition playbook</h2>
          <p className="text-sm text-surface-500">Something went wrong. Try refreshing.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-against-500/20 border border-against-500/40 text-against-300 text-sm font-mono hover:bg-against-500/30 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
          <Link
            href=".."
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-100 border border-surface-300 text-surface-400 text-sm font-mono hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Go back
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
