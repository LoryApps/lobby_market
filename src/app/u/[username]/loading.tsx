export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-surface-200">
        <div className="h-4 w-32 rounded bg-surface-300 animate-pulse" />
        <div className="h-4 w-16 rounded bg-surface-300 animate-pulse" />
      </header>
      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-lg space-y-4">
          {/* Identity card skeleton */}
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-surface-300 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-6 w-40 rounded bg-surface-300 animate-pulse" />
                <div className="h-4 w-28 rounded bg-surface-300 animate-pulse" />
                <div className="h-4 w-full rounded bg-surface-300 animate-pulse" />
              </div>
            </div>
          </div>
          {/* Stats skeleton */}
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center space-y-1.5">
                <div className="h-4 w-4 rounded bg-surface-300 animate-pulse mx-auto" />
                <div className="h-5 w-10 rounded bg-surface-300 animate-pulse mx-auto" />
                <div className="h-3 w-14 rounded bg-surface-300 animate-pulse mx-auto" />
              </div>
            ))}
          </div>
          {/* Arguments skeleton */}
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="p-3.5 rounded-xl border border-surface-300 space-y-2">
                <div className="h-4 w-full rounded bg-surface-300 animate-pulse" />
                <div className="h-4 w-3/4 rounded bg-surface-300 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
