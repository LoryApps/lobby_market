import { Skeleton } from '@/components/ui/Skeleton'

export default function ClipsLoading() {
  return (
    <div className="fixed inset-0 bg-surface-0 flex flex-col">
      {/* Top bar skeleton */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300/40 bg-surface-50/90">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      {/* Card skeleton */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <Skeleton className="w-full rounded-2xl" style={{ height: '70vh' }} />
        </div>
      </div>
      {/* Navigation dots skeleton */}
      <div className="flex justify-center gap-1.5 pb-24">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-1.5 w-1.5 rounded-full" />
        ))}
      </div>
    </div>
  )
}
