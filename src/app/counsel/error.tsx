'use client'

export default function CounselError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <p className="text-white font-mono mb-4">The Counsel is temporarily unavailable.</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-purple/20 text-purple border border-purple/30 text-sm font-mono hover:bg-purple/30 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
