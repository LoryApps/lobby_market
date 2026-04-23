'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Error() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="flex justify-center mb-4">
          <div className="h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-against-400" />
          </div>
        </div>
        <h1 className="text-xl font-mono font-bold text-white mb-2">Argument not found</h1>
        <p className="text-sm font-mono text-surface-500 mb-6">
          This argument may have been removed or the link is invalid.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
        >
          Back to Lobby Market
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
