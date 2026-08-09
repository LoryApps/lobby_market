'use client'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="font-mono text-surface-400">Failed to load deadlocked debates</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-300 font-mono text-sm hover:text-white transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
