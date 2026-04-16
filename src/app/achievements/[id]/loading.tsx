export default function AchievementLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <div className="h-14 bg-surface-100 border-b border-surface-300 animate-pulse" />
      <div className="max-w-2xl mx-auto px-4 py-10 w-full space-y-6">
        <div className="h-5 w-32 bg-surface-300 rounded-lg animate-pulse" />
        <div className="rounded-3xl border border-surface-300 bg-surface-100 p-10 flex flex-col items-center gap-6 animate-pulse">
          <div className="h-6 w-24 bg-surface-300 rounded-full" />
          <div className="h-24 w-24 bg-surface-300 rounded-3xl" />
          <div className="h-5 w-48 bg-surface-300 rounded" />
          <div className="h-9 w-64 bg-surface-300 rounded" />
          <div className="h-4 w-48 bg-surface-300 rounded" />
          <div className="h-10 w-36 bg-surface-300 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
