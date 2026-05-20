'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function CensusError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col min-h-screen bg-surface-100 items-center justify-center p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-against-400 mb-4" />
      <h2 className="text-lg font-semibold text-white mb-2">Census unavailable</h2>
      <p className="text-sm text-surface-500 mb-6">Could not load platform data right now.</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 text-sm bg-for-600 hover:bg-for-500 text-white rounded-xl transition-colors"
        >
          Try again
        </button>
        <Link href="/" className="px-4 py-2 text-sm bg-surface-200 hover:bg-surface-300 text-white rounded-xl transition-colors">
          Go home
        </Link>
      </div>
    </div>
  )
}
