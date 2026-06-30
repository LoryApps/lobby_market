'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TopicArchetypesError({ reset }: { reset: () => void }) {
  const params = useParams<{ id: string }>()

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-24 text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30 mb-4">
          <AlertTriangle className="h-5 w-5 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">Failed to load archetype breakdown</h1>
        <p className="font-mono text-sm text-surface-400 mb-6">
          Something went wrong while loading this page.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="h-9 px-4 rounded-lg bg-for-600/80 hover:bg-for-500 text-white font-mono text-sm transition-colors"
          >
            Try again
          </button>
          <Link
            href={`/topic/${params?.id ?? ''}`}
            className="h-9 px-4 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-300 hover:text-white font-mono text-sm transition-colors inline-flex items-center"
          >
            Back to debate
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
