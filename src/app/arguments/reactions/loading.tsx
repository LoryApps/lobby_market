import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ReactionsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-60" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        {/* Reaction tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-32 rounded-full flex-shrink-0" />
          ))}
        </div>
        {/* Period selector */}
        <div className="flex gap-2 mb-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
        {/* Argument cards */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="ml-auto h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full mb-1.5" />
              <Skeleton className="h-3 w-full mb-1.5" />
              <Skeleton className="h-3 w-3/4 mb-4" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
