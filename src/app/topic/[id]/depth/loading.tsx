export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-900">
      <div className="h-14 bg-surface-800 border-b border-surface-700 animate-pulse" />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* stat cards */}
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-surface-800 animate-pulse" />
          ))}
        </div>
        {/* side bars */}
        <div className="h-28 rounded-xl bg-surface-800 animate-pulse" />
        {/* bucket chart */}
        <div className="h-24 rounded-xl bg-surface-800 animate-pulse" />
        {/* argument cards */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-surface-800 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
