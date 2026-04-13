'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function PulseError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-16 pb-24 md:pb-12 flex flex-col items-center text-center gap-5">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
          <AlertTriangle className="h-7 w-7 text-against-400" />
        </div>
        <div>
          <p className="font-mono font-semibold text-white text-lg">
            Pulse failed to load
          </p>
          <p className="text-sm text-surface-500 mt-1">
            Something went wrong fetching community arguments.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-white text-sm font-mono hover:bg-surface-300 transition-colors"
        >
          Back to Feed
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
