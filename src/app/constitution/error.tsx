'use client'

import Link from 'next/link'
import { BookOpen, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ConstitutionError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 flex items-center justify-center">
        <div className="text-center py-24 space-y-4">
          <div className="flex justify-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300">
              <BookOpen className="h-6 w-6 text-surface-500" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-base font-bold text-white">Failed to load the Constitution</p>
            <p className="font-mono text-xs text-surface-500">The document could not be retrieved.</p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
            <Link
              href="/law"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white text-sm font-mono font-semibold transition-colors"
            >
              View Law Codex
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
