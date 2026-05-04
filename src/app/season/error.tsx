'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function SeasonError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-xl mx-auto px-4 py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="font-mono text-xl font-bold text-white mb-2">Season unavailable</h1>
        <p className="text-sm text-surface-500 font-mono mb-6">
          Could not load the current season. Try again in a moment.
        </p>
        <Link href="/" className="text-sm font-mono text-for-400 hover:underline">
          Back to feed
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
