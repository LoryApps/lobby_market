'use client'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="text-center space-y-3 max-w-sm">
        <p className="font-mono text-white font-semibold">Failed to load Civic Tremor</p>
        <p className="text-sm font-mono text-surface-500">
          Could not read the seismograph. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
