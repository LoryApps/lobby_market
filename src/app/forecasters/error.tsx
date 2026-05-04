'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ForecastersError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-16 pb-24 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Failed to load forecasters</h1>
        <p className="text-sm text-surface-500 mb-6">Something went wrong fetching prediction data.</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-for-500/20 border border-for-500/40 text-for-300 text-sm font-mono hover:bg-for-500/30 transition-colors"
          >
            Try again
          </button>
          <Link href="/predictions" className="px-4 py-2 rounded-lg bg-surface-200 text-surface-500 text-sm font-mono hover:text-white transition-colors">
            My predictions
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
