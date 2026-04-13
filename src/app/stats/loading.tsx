export default function StatsLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-for-500/30 border-t-for-500 animate-spin" />
        <p className="text-xs font-mono text-surface-500">Loading stats…</p>
      </div>
    </div>
  )
}
