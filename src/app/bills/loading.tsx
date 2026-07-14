import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'

export default function BillsLoading() {
  return (
    <div className="min-h-screen bg-surface-950 p-4 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-6 w-32 rounded" />
      </div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[1,2,3,4].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
      <div className="flex gap-2 mb-4 overflow-hidden">
        {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-8 w-24 rounded-full shrink-0" />)}
      </div>
      <div className="space-y-3">
        {[1,2,3,4].map((i) => (
          <div key={i} className="rounded-xl border border-surface-700/50 bg-surface-900 p-4">
            <div className="flex gap-2 mb-3">
              <Skeleton className="h-5 w-28 rounded" />
              <Skeleton className="h-5 w-20 rounded" />
            </div>
            <SkeletonText lines={2} className="mb-3" />
            <Skeleton className="h-1.5 w-full rounded mb-3" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
