'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-surface-400 text-sm font-mono">Failed to load community.</p>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="px-4 h-8 rounded-lg text-xs font-mono bg-for-500/10 border border-for-500/30 text-for-400 hover:bg-for-500/20 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/tags"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All tags
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
