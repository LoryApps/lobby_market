import { Skeleton } from '@/components/ui/Skeleton'

export default function SchismLoading() {
  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-52 rounded-xl" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-4/5 rounded" />
        </div>

        {/* Stats card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-36 rounded" />
              <Skeleton className="h-10 w-24 rounded" />
            </div>
            <Skeleton className="h-8 w-8 rounded-xl" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface-200/50 rounded-xl p-3 space-y-1.5">
                <Skeleton className="h-6 w-8 rounded mx-auto" />
                <Skeleton className="h-2.5 w-full rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <Skeleton className="h-11 w-full rounded-xl" />

        {/* Cards */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <Skeleton className="h-3 w-4 rounded" />
                <Skeleton className="h-12 w-12 rounded-full" />
              </div>
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-4/5 rounded" />
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
