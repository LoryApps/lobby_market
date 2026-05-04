'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function KarmaError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4 pb-24">
        <AlertTriangle className="h-8 w-8 text-against-400" />
        <p className="font-mono text-sm text-surface-500 text-center">
          Could not load your Karma Score.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/analytics"
            className="px-4 py-2 rounded-lg bg-surface-200 text-surface-400 text-sm font-mono hover:bg-surface-300 transition-colors"
          >
            Back to Analytics
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
