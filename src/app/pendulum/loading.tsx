import { Skeleton } from '@/components/ui/Skeleton'

export default function PendulumLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100" />
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-24 space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-[220px] rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
