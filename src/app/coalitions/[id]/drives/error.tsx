'use client'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-8">
      <div className="text-center space-y-3">
        <p className="font-mono text-sm text-against-400">Failed to load voting drives.</p>
        <button
          onClick={reset}
          className="font-mono text-xs text-surface-500 hover:text-white underline"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
