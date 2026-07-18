'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function IdeaDetailError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-28 md:pb-12 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="font-mono font-bold text-xl text-white mb-2">Idea not found</h1>
        <p className="text-sm font-mono text-surface-500 mb-6">
          This idea may have been deleted or the link is invalid.
        </p>
        <Link
          href="/exchange/ideas"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-700 text-white text-sm font-mono transition-colors"
        >
          Browse ideas
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
