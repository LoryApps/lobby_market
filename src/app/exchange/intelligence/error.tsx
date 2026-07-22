'use client'

export default function IntelligenceError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="font-mono text-surface-400 text-sm">Failed to load market intelligence</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
