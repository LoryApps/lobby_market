import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50 px-4 pt-20 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div>
          <Skeleton className="h-6 w-48 rounded mb-1" />
          <Skeleton className="h-4 w-56 rounded" />
        </div>
      </div>
      {/* sort + category bar */}
      <div className="flex gap-2 mb-6">
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg ml-auto" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-200/60 border border-surface-300/60 p-4">
            <Skeleton className="h-3 w-1/3 rounded mb-2" />
            <Skeleton className="h-4 w-full rounded mb-1" />
            <Skeleton className="h-4 w-5/6 rounded mb-3" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
