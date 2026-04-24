'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function BriefError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-16 pb-24 md:pb-12 text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 mx-auto mb-4">
          <AlertTriangle className="h-7 w-7 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">Brief unavailable</h1>
        <p className="text-sm text-surface-500 mb-6 font-mono max-w-sm mx-auto">
          Your daily briefing could not be loaded. Try again or head to the live feed.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 text-sm font-mono hover:text-white hover:bg-surface-300 transition-colors"
          >
            Back to feed
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
