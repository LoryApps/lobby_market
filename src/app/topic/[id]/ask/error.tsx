'use client'

import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'

export default function AskError({ reset }: { reset: () => void }) {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm space-y-4">
        <div className="flex justify-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
            <AlertTriangle className="h-7 w-7 text-against-400" />
          </div>
        </div>
        <div>
          <h2 className="font-mono text-lg font-bold text-white">Could not load Q&amp;A</h2>
          <p className="text-sm text-surface-500 font-mono mt-1">Something went wrong loading the Q&amp;A.</p>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 text-white text-sm font-mono font-medium hover:bg-for-500 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    </div>
  )
}
