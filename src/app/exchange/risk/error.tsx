'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white mb-2">Failed to load risk data</h2>
        <p className="text-sm text-surface-500 mb-4">
          Could not compute your portfolio risk. Please try again.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 bg-for-600 hover:bg-for-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Try again
          </button>
          <Link
            href="/exchange"
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Exchange
          </Link>
        </div>
      </div>
    </div>
  )
}
