export default function GemsLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-gold/30" />
        <div className="h-3 w-24 rounded bg-surface-300" />
      </div>
    </div>
  )
}
