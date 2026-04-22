'use client'

import Link from 'next/link'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function BlitzError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
            <AlertCircle className="h-7 w-7 text-against-400" />
          </div>
          <h1 className="font-mono text-xl font-bold text-white">Blitz crashed</h1>
          <p className="text-sm text-surface-500 max-w-xs">Something went wrong loading the game.</p>
          <div className="flex gap-3 mt-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 text-surface-500 hover:text-white text-sm font-mono transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
            <button
              onClick={reset}
              className="px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
