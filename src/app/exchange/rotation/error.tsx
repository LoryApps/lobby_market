'use client'

import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

export default function RotationError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col items-center justify-center gap-4 px-4">
      <AlertTriangle className="w-10 h-10 text-against-400 opacity-60" />
      <h1 className="text-lg font-semibold text-surface-200">Failed to load sector data</h1>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-surface-800 text-surface-300 text-sm hover:bg-surface-700 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/exchange"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-surface-500 hover:text-surface-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Exchange
        </Link>
      </div>
    </div>
  )
}
