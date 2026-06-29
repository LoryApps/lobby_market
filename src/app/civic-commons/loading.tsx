export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-gold/40 border-t-gold animate-spin" />
        <p className="text-xs font-mono text-surface-500">Loading civic commons…</p>
      </div>
    </div>
  )
}
