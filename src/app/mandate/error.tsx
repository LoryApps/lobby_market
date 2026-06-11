'use client'

import Link from 'next/link'
import { Scale } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function MandateError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-20 pb-24 text-center">
        <Scale className="h-10 w-10 text-surface-400 mx-auto mb-4" />
        <h2 className="font-mono text-xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-surface-500 mb-6">Could not load the Civic Mandate page.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-mono text-for-400 hover:text-for-300 transition-colors"
        >
          ← Back to home
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
