export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-xl bg-surface-200" />
        <div className="h-4 w-40 rounded bg-surface-200" />
      </div>
    </div>
  )
}
