'use client'

import { AlertTriangle } from 'lucide-react'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="text-center">
        <AlertTriangle className="w-8 h-8 text-against-400 mx-auto mb-3" />
        <p className="text-surface-700 mb-4">Failed to load market trends.</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-for-500/20 text-for-300 text-sm hover:bg-for-500/30 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
