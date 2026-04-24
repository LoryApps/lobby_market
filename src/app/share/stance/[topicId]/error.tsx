'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function StanceShareError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-24 md:pb-12 flex flex-col items-center text-center gap-5">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <div>
          <h1 className="text-xl font-mono font-bold text-white mb-2">Topic not found</h1>
          <p className="text-sm font-mono text-surface-500">
            This shared link may have expired or the topic no longer exists.
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
        >
          Explore debates
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
