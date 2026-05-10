export default function GaugeLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <div className="h-14 bg-surface-100 border-b border-surface-300/30 animate-pulse" />
      <div className="flex-1 px-4 pt-8 max-w-lg mx-auto w-full space-y-6">
        <div className="h-8 w-48 rounded-xl bg-surface-200 animate-pulse" />
        <div className="h-4 w-64 rounded bg-surface-200 animate-pulse" />
        <div className="h-40 rounded-2xl bg-surface-200 animate-pulse" />
        <div className="h-12 rounded-full bg-surface-200 animate-pulse" />
        <div className="h-10 rounded-xl bg-surface-200 animate-pulse" />
      </div>
    </div>
  )
}
