'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function VotersError({ reset }: { error: Error; reset: () => void }) {
  const params = useParams()
  const topicId = typeof params.id === 'string' ? params.id : ''

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30 mx-auto mb-4">
          <AlertCircle className="h-5 w-5 text-against-400" />
        </div>
        <p className="text-white font-mono font-semibold text-sm mb-1">Failed to load voters</p>
        <p className="text-surface-500 text-xs font-mono mb-6">Check your connection and try again.</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
          >
            Try again
          </button>
          {topicId && (
            <Link
              href={`/topic/${topicId}`}
              className="px-4 py-2 rounded-lg bg-for-600 hover:bg-for-700 text-sm font-mono text-white transition-colors"
            >
              Back to topic
            </Link>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
