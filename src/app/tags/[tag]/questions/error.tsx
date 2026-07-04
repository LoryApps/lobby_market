'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TagQuestionsError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-16 pb-24 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="font-mono text-lg font-bold text-white mb-2">
          Failed to load questions
        </h1>
        <p className="font-mono text-sm text-surface-500 mb-6">
          Something went wrong fetching questions for this tag.
        </p>
        <Link
          href="/questions"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-300 hover:text-white transition-colors"
        >
          Browse all questions
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
