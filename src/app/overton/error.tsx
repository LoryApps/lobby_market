'use client'

export default function OvertonsWindowError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-sm font-mono text-against-400 mb-3">
          Failed to load The Overton Window
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-white hover:bg-surface-300 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
