export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-surface-400 text-sm">Loading mood history…</p>
      </div>
    </div>
  )
}
