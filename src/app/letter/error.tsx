'use client'

import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LetterError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-24 pb-24 md:pb-12 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-sm font-mono text-surface-500 mb-6">
          Could not load the Civic Letter Generator. Please try again.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-mono text-for-400 hover:text-for-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
