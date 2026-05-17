export default function Loading() {
  return (
    <div className="h-screen bg-surface-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-for-500 border-t-transparent animate-spin" />
        <p className="font-mono text-sm text-surface-500">Loading reel…</p>
      </div>
    </div>
  )
}
