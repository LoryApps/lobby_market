'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function StressTestError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-16 pb-28 md:pb-16 flex flex-col items-center text-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white">Something went wrong</h1>
        <p className="text-sm font-mono text-surface-500">The Stress Tester encountered an error.</p>
        <Link
          href="/stress-test"
          className="mt-2 px-5 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-sm font-mono text-white transition-colors"
        >
          Try again
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
