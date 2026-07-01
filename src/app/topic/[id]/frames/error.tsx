'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function FramesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams()
  const topicId = params?.id as string | undefined

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-16 text-center">
        <div className="w-12 h-12 rounded-full bg-against-500/10 border border-against-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6 text-against-400" />
        </div>
        <h1 className="text-lg font-semibold text-surface-800 mb-2">Failed to load frames</h1>
        <p className="text-sm text-surface-500 mb-6">{error.message ?? 'Something went wrong.'}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-sm text-surface-600 hover:text-surface-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          {topicId && (
            <Link
              href={`/topic/${topicId}`}
              className="flex items-center gap-1.5 text-sm text-surface-600 hover:text-surface-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to debate
            </Link>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
