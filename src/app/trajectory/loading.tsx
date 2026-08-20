import { Skeleton } from '@/components/ui/Skeleton'

export default function TrajectoryLoading() {
  return (
    <div className="min-h-screen bg-surface-50 pb-20">
      <div className="h-14 bg-surface-200 border-b border-surface-300" />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <Skeleton className="h-8 w-52" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
