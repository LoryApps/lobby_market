'use client'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <p className="text-surface-500 font-mono text-sm">Convention temporarily adjourned</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-gold/20 border border-gold/40 text-gold text-sm font-mono hover:bg-gold/30 transition-colors"
        >
          Reconvene
        </button>
      </div>
    </div>
  )
}
