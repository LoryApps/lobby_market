'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LawExploreError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-16 pb-24 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="text-lg font-bold text-white mb-2">Failed to load</h1>
        <p className="text-sm text-surface-500 mb-6">Could not load the Law Codex explorer. Please try again.</p>
        <Link
          href="/law"
          className="inline-flex items-center gap-1.5 text-sm text-for-400 hover:text-for-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to the Codex
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
