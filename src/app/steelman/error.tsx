'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function SteelmanError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-sm">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 mx-auto">
            <AlertTriangle className="h-7 w-7 text-against-400" />
          </div>
          <h1 className="font-mono text-xl font-bold text-white">Something went wrong</h1>
          <p className="text-sm font-mono text-surface-400">
            The Steelman Engine encountered an error. Please try again.
          </p>
          <div className="flex items-center gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-sm font-mono text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-300 text-sm font-mono text-surface-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Home
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
