import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ResolvedLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>

        {/* Resolved markets */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="flex gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
