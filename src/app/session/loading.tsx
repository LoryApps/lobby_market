import { Skeleton } from '@/components/ui/Skeleton'

export default function SessionLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <div className="sticky top-0 z-40 bg-surface-100/80 backdrop-blur border-b border-surface-300 h-14" />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 pb-28 pt-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Progress bar */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>

        {/* Topic cards */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-7 w-7 rounded-full flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-11 rounded-xl" />
              <Skeleton className="h-11 rounded-xl" />
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
