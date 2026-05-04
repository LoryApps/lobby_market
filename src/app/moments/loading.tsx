export default function MomentsLoading() {
  return (
    <div className="fixed inset-0 bg-surface-950 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-full bg-emerald/10 flex items-center justify-center animate-pulse">
        <div className="w-6 h-6 rounded-full bg-emerald/30" />
      </div>
      <p className="text-surface-400 text-sm">Loading moments…</p>
    </div>
  )
}
