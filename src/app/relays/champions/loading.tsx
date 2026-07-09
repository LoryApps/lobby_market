export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 bg-surface-100 border-b border-surface-300" />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="h-7 w-48 rounded-lg bg-surface-200 animate-pulse" />
        <div className="h-4 w-72 rounded bg-surface-300 animate-pulse" />
        <div className="flex gap-2 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-24 rounded-full bg-surface-200 animate-pulse" />
          ))}
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-surface-100 border border-surface-200">
              <div className="h-10 w-10 rounded-full bg-surface-300 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-36 rounded bg-surface-300 animate-pulse" />
                <div className="h-3 w-48 rounded bg-surface-300/60 animate-pulse" />
              </div>
              <div className="h-6 w-16 rounded-full bg-surface-300 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
