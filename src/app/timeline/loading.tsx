import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TimelineLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        {/* Filter bar */}
        <Skeleton className="h-10 w-full rounded-xl mb-6" />

        {/* Timeline skeleton */}
        <div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex gap-4 mb-6">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <Skeleton className="h-9 w-9 rounded-xl" />
                {i < 6 && <Skeleton className="w-px h-16" />}
              </div>
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-4/5" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
