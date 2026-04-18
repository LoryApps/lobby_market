'use client'

export default function PositionsError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="text-center px-4">
        <p className="text-surface-400 font-mono text-sm mb-4">Failed to load positions</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-surface-200 text-white text-sm font-mono hover:bg-surface-300 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
