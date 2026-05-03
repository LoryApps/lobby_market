'use client'

import Link from 'next/link'
import { MonitorPlay } from 'lucide-react'

export default function StageIdError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center px-4">
        <MonitorPlay className="h-10 w-10 text-surface-500" />
        <p className="text-white font-mono font-semibold">Failed to load topic</p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/stage"
            className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 text-sm font-mono hover:text-white transition-colors"
          >
            ← Stage
          </Link>
        </div>
      </div>
    </div>
  )
}
