import { Skeleton } from '@/components/ui/Skeleton'

export default function PredictionsAnalyticsLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <div className="h-14 bg-surface-100 border-b border-surface-300" />
      <div className="w-full max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <Skeleton className="h-3 w-14 mb-3" />
              <Skeleton className="h-7 w-16 mb-1" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  )
}
