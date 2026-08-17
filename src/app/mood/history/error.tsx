'use client'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center px-4">
        <p className="text-2xl">📉</p>
        <h2 className="text-surface-100 font-semibold">Failed to load mood history</h2>
        <p className="text-surface-400 text-sm max-w-xs">Something went wrong fetching the trend data. Try again.</p>
        <button
          onClick={reset}
          className="mt-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 text-sm hover:bg-purple-500/30 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
