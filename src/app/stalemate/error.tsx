'use client'

export default function StalemateError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <p className="text-surface-400 text-sm">Failed to load stalemate data.</p>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm rounded-lg bg-surface-700 text-surface-200 hover:bg-surface-600 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
