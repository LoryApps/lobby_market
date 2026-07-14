import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'

export default function BillDetailLoading() {
  return (
    <div className="min-h-screen bg-surface-950 p-4 pb-24 max-w-2xl mx-auto">
      <Skeleton className="h-4 w-20 rounded mb-4" />
      <div className="rounded-xl border border-surface-700/50 bg-surface-900 p-5 mb-4">
        <div className="flex gap-2 mb-3">
          <Skeleton className="h-5 w-28 rounded" />
          <Skeleton className="h-5 w-20 rounded" />
        </div>
        <Skeleton className="h-7 w-4/5 rounded mb-2" />
        <SkeletonText lines={3} className="mb-4" />
        <div className="flex items-center gap-2 border-t border-surface-800 pt-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div>
            <Skeleton className="h-4 w-28 rounded mb-1" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
        </div>
      </div>
      <Skeleton className="h-40 rounded-xl mb-4" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
