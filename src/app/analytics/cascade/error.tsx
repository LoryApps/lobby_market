'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('[cascade]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto" />
        <p className="text-surface-300 text-sm">Failed to load your cascade data.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm transition-colors"
          >
            Try again
          </button>
          <Link
            href="/analytics"
            className="px-4 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-200 text-sm transition-colors"
          >
            Back to Analytics
          </Link>
        </div>
      </div>
    </div>
  )
}
