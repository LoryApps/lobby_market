'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function CompareError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center gap-4 p-8">
      <AlertTriangle className="h-10 w-10 text-against-400" />
      <div className="text-center">
        <p className="font-mono font-semibold text-white text-lg">Something went wrong</p>
        <p className="text-sm font-mono text-surface-500 mt-1">
          Could not load the comparison view.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
