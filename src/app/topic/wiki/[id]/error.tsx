'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'

export default function WikiError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[TopicWikiError]', error)
  }, [error])

  const router = useRouter()

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
            <AlertTriangle className="h-7 w-7 text-against-400" />
          </div>
        </div>
        <div>
          <h1 className="font-mono text-xl font-bold text-white mb-1.5">
            Failed to load wiki
          </h1>
          <p className="text-sm text-surface-500 font-mono">
            Something went wrong loading this topic&apos;s wiki content.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-white text-sm font-mono hover:bg-surface-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Go back
          </button>
        </div>
      </div>
    </div>
  )
}
