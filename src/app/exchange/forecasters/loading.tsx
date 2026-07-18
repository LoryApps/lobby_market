import { Skeleton } from '@/components/ui/Skeleton'

export default function ForecastersLoading() {
  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-16">
        <div className="py-5 space-y-2">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-6 w-52 rounded" />
          <Skeleton className="h-3.5 w-72 rounded" />
        </div>
        {/* Global stats skeleton */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        {/* Sort tabs skeleton */}
        <div className="flex gap-1.5 mb-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-xl" />
          ))}
        </div>
        {/* Rows */}
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
