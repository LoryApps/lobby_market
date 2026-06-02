export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-against-500/30 border-t-against-400 animate-spin" />
        <p className="text-sm font-mono text-surface-500">Reading tremors…</p>
      </div>
    </div>
  )
}
