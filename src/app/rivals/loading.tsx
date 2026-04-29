import { Skeleton } from '@/components/ui/Skeleton'

export default function RivalsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header skeleton */}
        <div className="mb-8 flex items-start gap-3">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 rounded-2xl border border-surface-300/40 bg-surface-100 animate-pulse"
            >
              <div className="h-[52px] w-[52px] rounded-full bg-surface-300/50 flex-shrink-0" />
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-10 w-10 rounded-full bg-surface-300/50 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-8 w-20 rounded-lg flex-shrink-0 hidden sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
