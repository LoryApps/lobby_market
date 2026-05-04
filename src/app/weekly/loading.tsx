export default function WeeklyLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="flex items-center gap-2 font-mono text-sm text-surface-500 animate-pulse">
        <span className="h-2 w-2 rounded-full bg-gold animate-bounce" />
        Loading weekly digest…
      </div>
    </div>
  )
}
