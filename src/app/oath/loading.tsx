import { Skeleton } from '@/components/ui/Skeleton'

export default function OathLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center px-4 pt-20 pb-24 space-y-6">
      <div className="w-full max-w-2xl space-y-8">
        {/* Icon skeleton */}
        <div className="flex justify-center">
          <Skeleton className="h-16 w-16 rounded-2xl" />
        </div>
        {/* Title */}
        <div className="space-y-2 flex flex-col items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        {/* Value cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        {/* CTA */}
        <div className="flex justify-center">
          <Skeleton className="h-11 w-40 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
