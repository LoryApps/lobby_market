'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

export default function DebatePrepError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams()
  const topicId = params?.id as string

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-2xl border border-against-500/30 bg-against-500/10 p-8 text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto" />
        <div>
          <h2 className="text-white font-semibold mb-1">Debate Prep unavailable</h2>
          <p className="text-sm text-surface-400">
            We couldn&apos;t load the debate prep kit for this topic.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-sm text-white transition-colors"
          >
            Try again
          </button>
          <Link
            href={topicId ? `/topic/${topicId}` : '/'}
            className="flex items-center justify-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to topic
          </Link>
        </div>
      </div>
    </div>
  )
}
