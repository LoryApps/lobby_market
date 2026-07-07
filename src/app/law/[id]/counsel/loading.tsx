export default function LawCounselLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-900">
      {/* Header skeleton */}
      <div className="flex-none border-b border-surface-700/50 bg-surface-800/80 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gold/20 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-48 bg-surface-600 rounded animate-pulse" />
            <div className="h-3 w-32 bg-surface-700 rounded animate-pulse" />
          </div>
          <div className="h-6 w-20 bg-surface-700 rounded animate-pulse" />
        </div>
      </div>

      {/* Chat area skeleton */}
      <div className="flex-1 overflow-hidden px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Welcome card skeleton */}
          <div className="rounded-xl border border-gold/20 bg-gold/5 p-5 space-y-3 animate-pulse">
            <div className="h-5 w-40 bg-gold/20 rounded" />
            <div className="h-3.5 w-full bg-surface-700 rounded" />
            <div className="h-3.5 w-5/6 bg-surface-700 rounded" />
            <div className="grid grid-cols-2 gap-2 mt-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 bg-surface-700/50 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Input skeleton */}
      <div className="flex-none border-t border-surface-700/50 bg-surface-800/80 px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <div className="flex-1 h-10 bg-surface-700 rounded-xl animate-pulse" />
          <div className="h-10 w-10 bg-gold/20 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  )
}
