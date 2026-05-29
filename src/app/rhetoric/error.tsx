'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function RhetoricError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error('[RhetoricError]', error) }, [error])
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto" />
        <p className="font-mono text-white text-lg font-bold">Failed to load rhetoric data</p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  )
}
