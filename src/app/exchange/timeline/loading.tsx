import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TimelineLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="mx-auto max-w-2xl px-4 py-8 pb-28 md:pb-12">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3.5 w-56" />
            </div>
            <div className="ml-auto flex gap-2">
              <Skeleton className="h-8 w-16 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
          <Skeleton className="mb-4 h-3.5 w-48" />
          <div className="flex gap-1.5 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-16 shrink-0 rounded-full" />
            ))}
          </div>
        </div>

        {/* Timeline skeleton */}
        <div className="space-y-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="relative flex gap-4">
              <div className="relative flex flex-col items-center">
                <Skeleton className="mt-1 h-3 w-3 rounded-full" />
                <div className="mt-1 w-px flex-1 min-h-[90px] bg-surface-300/30" />
              </div>
              <div className="mb-4 flex-1">
                <Skeleton className="h-[90px] w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
