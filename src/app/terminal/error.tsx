'use client'

import Link from 'next/link'
import { Activity } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TerminalError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center text-center gap-4">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30">
          <Activity className="h-6 w-6 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white">Terminal offline</h1>
        <p className="text-sm font-mono text-surface-500 max-w-sm">
          Failed to load the consensus terminal. Check your connection and try again.
        </p>
        <Link
          href="/"
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600/20 border border-for-600/30 text-for-400 font-mono text-sm hover:bg-for-600/30 transition-colors"
        >
          Back to Lobby
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
