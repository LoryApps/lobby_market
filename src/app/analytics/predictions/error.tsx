'use client'

export default function PredictionsAnalyticsError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center p-8">
      <p className="text-sm text-surface-500 font-mono mb-4">
        Failed to load prediction analytics.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 border border-surface-400/40 text-white text-xs font-mono transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
