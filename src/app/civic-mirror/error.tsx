'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CivicMirrorError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-20 pb-28 flex flex-col items-center gap-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-against-500/10 border border-against-500/20">
          <AlertTriangle className="h-7 w-7 text-against-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-surface-100 mb-1">Mirror unavailable</h2>
          <p className="text-sm text-surface-400">Something went wrong loading today&apos;s challenge.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={reset} className="rounded-xl border border-surface-400 bg-surface-200 px-5 py-2.5 text-sm font-semibold text-surface-200 hover:bg-surface-300 transition-colors">
            Try again
          </button>
          <Link href="/arcade" className="rounded-xl bg-for-600 hover:bg-for-500 px-5 py-2.5 text-sm font-bold text-white transition-colors">
            Back to Arcade
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
