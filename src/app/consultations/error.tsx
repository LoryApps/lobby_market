'use client'

import { AlertTriangle } from 'lucide-react'

export default function ConsultationsError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto" />
        <h2 className="font-mono text-lg font-semibold text-white">Failed to load consultations</h2>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
