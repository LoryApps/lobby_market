export default function PromptLoading() {
  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      {/* TopBar skeleton */}
      <div className="h-14 bg-surface-900 border-b border-surface-800 animate-pulse" />

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20 pt-6 gap-6 max-w-lg mx-auto w-full">
        {/* Date chip */}
        <div className="h-6 w-28 rounded-full bg-surface-800 animate-pulse" />

        {/* Statement */}
        <div className="w-full space-y-3">
          <div className="h-5 w-full rounded bg-surface-800 animate-pulse" />
          <div className="h-5 w-4/5 rounded bg-surface-800 animate-pulse" />
          <div className="h-5 w-3/5 rounded bg-surface-800 animate-pulse" />
        </div>

        {/* FOR / AGAINST buttons */}
        <div className="w-full grid grid-cols-2 gap-4 mt-4">
          <div className="h-32 rounded-2xl bg-surface-800 animate-pulse" />
          <div className="h-32 rounded-2xl bg-surface-800 animate-pulse" />
        </div>

        {/* Community bar */}
        <div className="w-full h-8 rounded-full bg-surface-800 animate-pulse mt-2" />

        {/* Hot takes label */}
        <div className="h-4 w-24 rounded bg-surface-800 animate-pulse self-start mt-4" />

        {/* Hot take rows */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-full flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-surface-800 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-surface-800 animate-pulse" />
              <div className="h-3 w-full rounded bg-surface-800 animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* BottomNav skeleton */}
      <div className="h-16 bg-surface-900 border-t border-surface-800 animate-pulse" />
    </div>
  )
}
