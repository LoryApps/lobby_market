import { Skeleton } from '@/components/ui/Skeleton'

export default function CivicVerdictLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      {/* TopBar */}
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-5 w-36" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 pt-8 pb-24 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <Skeleton className="h-8 w-44 mx-auto" />
            <Skeleton className="h-4 w-72 mx-auto" />
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>

          {/* FOR argument card */}
          <div className="rounded-2xl bg-surface-100 border border-for-500/30 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>

          {/* AGAINST argument card */}
          <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* Verdict buttons */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        </div>
      </main>

      {/* BottomNav */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-surface-100 border-t border-surface-300 flex items-center justify-around px-2 md:hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-2 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}
