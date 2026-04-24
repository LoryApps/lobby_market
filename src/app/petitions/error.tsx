'use client'

import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'

export default function PetitionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto" />
        <p className="font-mono text-white font-semibold">Something went wrong</p>
        <p className="font-mono text-sm text-surface-500">Could not load petitions</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-surface-200 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
