import { Skeleton } from '@/components/ui/Skeleton'

export default function LegacyLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* TopBar skeleton */}
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between">
        <Skeleton className="h-7 w-32" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-28 space-y-5 animate-pulse">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>

        {/* Hero card */}
        <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 md:p-8 space-y-5">
          <div className="flex items-start gap-5">
            <Skeleton className="h-20 w-20 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2.5">
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-5 w-32 rounded-full" />
              <Skeleton className="h-3.5 w-44" />
            </div>
            <Skeleton className="h-16 w-24 rounded-2xl flex-shrink-0" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-5 w-12" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-surface-200 border border-surface-300 p-3 flex flex-col items-center gap-1.5">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-6 w-10" />
                <Skeleton className="h-2.5 w-14" />
              </div>
            ))}
          </div>
        </div>

        {/* Milestones */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>

        {/* Laws */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-28" />
          </div>
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
