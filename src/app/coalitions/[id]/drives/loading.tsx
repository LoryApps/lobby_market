import { Skeleton } from '@/components/ui/Skeleton'

function DriveCardSkeleton() {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1.5 min-w-0">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-lg ml-auto" />
      </div>
    </div>
  )
}

export default function DrivesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-36" />
      </div>
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <DriveCardSkeleton key={i} />
        ))}
      </main>
    </div>
  )
}
