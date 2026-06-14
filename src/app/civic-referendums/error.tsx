'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CivicReferendumsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex items-center justify-center pb-24">
        <div className="text-center space-y-4 px-4">
          <AlertTriangle className="h-8 w-8 text-against-400 mx-auto" />
          <h2 className="font-mono text-sm font-bold text-white">Failed to load referendums</h2>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200/60 border border-surface-300/60 font-mono text-xs text-white hover:border-surface-400/60 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
            <Link href="/" className="font-mono text-xs text-for-400 hover:underline">
              Back home
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
