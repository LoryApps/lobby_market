'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'

export default function CounselError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams<{ id: string }>()
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-50 px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-against-400" />
          </div>
        </div>
        <div>
          <h1 className="font-mono text-xl font-bold text-white mb-2">Counsel unavailable</h1>
          <p className="text-sm text-surface-500 font-mono">
            The Topic Counsel couldn&apos;t load. Try again or return to the topic.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 text-white text-sm font-mono font-medium hover:bg-for-500 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href={`/topic/${params?.id ?? ''}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-white text-sm font-mono font-medium hover:bg-surface-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to topic
          </Link>
        </div>
      </div>
    </div>
  )
}
