'use client'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-surface-500 text-sm mb-4">Failed to load Founding Citizens.</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-white text-sm font-mono hover:bg-surface-300 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
