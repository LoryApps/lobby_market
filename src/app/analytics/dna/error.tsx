'use client'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center gap-4 px-4">
      <p className="text-white font-mono text-lg">Failed to load Argument DNA</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
