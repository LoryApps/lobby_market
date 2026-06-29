'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { useParams } from 'next/navigation'

export default function NarrativeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams()
  const topicId = params?.id as string | undefined

  useEffect(() => {
    console.error('[narrative] page error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-against-500/10 border border-against-500/30">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <div className="space-y-1">
          <p className="font-mono text-sm font-semibold text-white">Something went wrong</p>
          <p className="text-xs font-mono text-surface-500">The narrative arc could not load.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-white hover:bg-surface-300 transition-colors"
          >
            Try again
          </button>
          {topicId && (
            <Link
              href={`/topic/${topicId}`}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
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
