'use client'

import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">
        <Link
          href="/topics"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Topics
        </Link>
        <div className="flex flex-col items-center justify-center text-center py-16">
          <AlertCircle className="h-10 w-10 text-against-400 mb-4" />
          <h1 className="font-mono text-lg font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-sm font-mono text-surface-500 mb-6">
            Could not load fresh topics. Please try again.
          </p>
          <button
            onClick={reset}
            className="px-5 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono transition-colors"
          >
            Try again
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
