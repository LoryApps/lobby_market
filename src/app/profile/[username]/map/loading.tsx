export default function ProfileMapLoading() {
  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      {/* Header skeleton */}
      <div className="border-b border-surface-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-800 animate-pulse" />
          <div className="w-40 h-5 rounded bg-surface-800 animate-pulse" />
        </div>
      </div>

      {/* Stats bar skeleton */}
      <div className="border-b border-surface-800 px-4 py-2">
        <div className="max-w-6xl mx-auto flex gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="w-16 h-3 rounded bg-surface-800 animate-pulse" />
              <div className="w-8 h-5 rounded bg-surface-800 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Map canvas skeleton */}
      <div className="flex-1 relative overflow-hidden bg-surface-950">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[600px] h-[500px] rounded-2xl bg-surface-900 animate-pulse opacity-40" />
        </div>
        {/* Scattered node skeletons */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-surface-800 animate-pulse"
            style={{
              width: `${8 + (i % 4) * 3}px`,
              height: `${8 + (i % 4) * 3}px`,
              left: `${15 + (i * 7) % 70}%`,
              top: `${20 + (i * 11) % 60}%`,
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
