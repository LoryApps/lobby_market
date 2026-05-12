'use client'

import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function VotesAnalyticsError() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center gap-5 px-4 pb-24">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30">
            <AlertCircle className="h-6 w-6 text-against-400" />
          </div>
          <h2 className="font-mono font-bold text-white">Could not load vote history</h2>
          <p className="text-sm text-surface-500 font-mono">
            Something went wrong loading your voting patterns. Try again in a moment.
          </p>
        </div>
        <Link
          href="/analytics"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-surface-700 hover:bg-surface-300 hover:text-white transition-colors font-mono text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Analytics
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
