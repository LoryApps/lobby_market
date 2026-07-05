import { Skeleton } from '@/components/ui/Skeleton'

export default function GymLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <div className="h-14 border-b border-surface-300/60 bg-surface-100" />
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Hero */}
        <div className="rounded-2xl border border-surface-300/60 bg-surface-200/60 p-6">
          <div className="flex items-center gap-5">
            <Skeleton className="h-24 w-24 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-4 w-32 mt-3" />
            </div>
          </div>
        </div>
        {/* Exercises */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-surface-300/60 bg-surface-200/60 p-5 space-y-4"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}
