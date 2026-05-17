'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function JourneyError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-24 text-center">
        <AlertCircle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <p className="font-mono text-sm font-semibold text-white mb-1">Could not load your journey</p>
        <p className="font-mono text-xs text-surface-500 mb-6">There was a problem fetching your timeline.</p>
        <Link
          href="/analytics"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 text-white text-xs font-mono font-semibold hover:bg-for-700 transition-colors"
        >
          Back to Analytics
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
