'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function StatusError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="h-10 w-10 text-gold mb-4" />
        <h1 className="font-mono text-xl font-bold text-white mb-2">Status unavailable</h1>
        <p className="font-mono text-sm text-surface-500 mb-6">
          An error occurred while loading the status page.
        </p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white font-mono text-sm transition-colors"
          >
            Retry
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white font-mono text-sm transition-colors"
          >
            Go home
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
