export default function OvertonsWindowLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 rounded-full border-2 border-for-400 border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-xs font-mono text-surface-500">Mapping the window…</p>
      </div>
    </div>
  )
}
