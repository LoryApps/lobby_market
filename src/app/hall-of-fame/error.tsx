'use client'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <p className="font-mono text-lg font-bold text-white">Failed to load</p>
        <p className="text-sm font-mono text-surface-500">Something went wrong loading the Hall of Fame.</p>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-mono bg-surface-200 hover:bg-surface-300 text-white rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
