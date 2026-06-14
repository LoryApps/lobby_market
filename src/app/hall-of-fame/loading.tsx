export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 animate-pulse" />
        <p className="text-sm font-mono text-surface-500">Loading Hall of Fame…</p>
      </div>
    </div>
  )
}
