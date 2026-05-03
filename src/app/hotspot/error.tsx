'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function HotspotError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <h2 className="font-mono text-lg font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-sm font-mono text-surface-500 max-w-sm mx-auto mb-6">
          The hotspot data could not be loaded. Please try again.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-500 hover:text-white transition-colors"
        >
          Back to feed
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
