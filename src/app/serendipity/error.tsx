'use client'

export default function SerendipityError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-surface-950 px-4">
      <p className="text-surface-400 text-center">Something went wrong loading your serendipity feed.</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-surface-200 text-white text-sm hover:bg-surface-300 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
