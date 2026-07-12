'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'

export default function ReportDetailError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-against-400" />
          </div>
        </div>
        <p className="font-mono font-bold text-white text-lg">Failed to load report</p>
        <p className="text-sm text-surface-500 font-mono">
          {error.message ?? 'This report could not be loaded.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-surface-300 text-sm font-mono hover:bg-surface-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All reports
          </Link>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
