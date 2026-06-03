export default function StalemateLoading() {
  return (
    <div className="min-h-screen bg-surface-900 flex flex-col">
      <div className="h-14 bg-surface-800/60 border-b border-surface-700/50 animate-pulse" />
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
        <div className="h-8 w-48 bg-surface-700/60 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-surface-700/40 rounded-xl animate-pulse" />
          ))}
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-28 bg-surface-700/30 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
