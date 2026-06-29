export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-for-500/20 border border-for-500/30 animate-pulse" />
        <div className="text-xs font-mono text-surface-500">Loading doctrine&hellip;</div>
      </div>
    </div>
  )
}
