export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-2xl mx-auto px-4 pb-24 pt-16">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-surface-300/50 rounded" />
          <div className="h-4 w-72 bg-surface-300/40 rounded" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-28" />
            ))}
          </div>
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 h-40" />
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 h-48" />
        </div>
      </div>
    </div>
  )
}
