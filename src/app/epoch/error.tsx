'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function EpochError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-24 flex flex-col items-center text-center gap-4">
        <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-against-500/10 border border-against-500/20">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <p className="font-mono font-bold text-white">Epoch data unavailable</p>
        <p className="text-sm font-mono text-surface-500 max-w-xs">
          Something went wrong loading the platform&apos;s civic epoch history. Try refreshing.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-medium bg-for-600/20 border border-for-600/30 text-for-400 hover:bg-for-600/30 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
          <Link
            href="/chronicle"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-medium bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
          >
            Browse chronicle
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
