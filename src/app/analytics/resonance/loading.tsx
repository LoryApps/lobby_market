export default function ResonanceLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 bg-surface-100 border-b border-surface-300" />
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4 animate-pulse">
        <div className="h-36 rounded-2xl bg-surface-100 border border-surface-300/40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-surface-100 border border-surface-300/40" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-surface-100 border border-surface-300/40" />
        ))}
      </div>
    </div>
  )
}
