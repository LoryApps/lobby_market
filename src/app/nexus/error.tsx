'use client'

import Link from 'next/link'
import { Network } from 'lucide-react'

export default function NexusError({ reset }: { reset: () => void }) {
  return (
    <div className="h-screen bg-surface-50 flex flex-col items-center justify-center gap-4 text-center px-4">
      <Network className="h-10 w-10 text-surface-500" aria-hidden="true" />
      <p className="text-sm font-mono text-surface-500">The nexus graph failed to load.</p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg text-sm font-mono text-surface-500 hover:text-white transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
