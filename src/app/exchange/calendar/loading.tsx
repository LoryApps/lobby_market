import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CalendarLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Month header */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>

        {/* Calendar grid */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>

        {/* Upcoming events */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 p-4">
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
