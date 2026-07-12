'use client'

import Link from 'next/link'
import { RefreshCw, Landmark } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ParliamentError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-100">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pb-24 pt-20 text-center">
        <div className="p-3 rounded-2xl bg-surface-200 border border-surface-300 w-fit mx-auto mb-4">
          <Landmark className="h-6 w-6 text-surface-500" />
        </div>
        <h1 className="text-lg font-bold text-white mb-2">Parliament is in recess</h1>
        <p className="text-sm text-surface-500 mb-6">
          There was an issue loading the parliamentary chambers. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 text-white text-sm font-semibold hover:bg-for-500 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Reconvene Parliament
        </button>
        <Link
          href="/"
          className="block mt-4 text-sm text-surface-500 hover:text-surface-400 transition-colors"
        >
          Return to the Lobby
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
