import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function RelayHallOfFameLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-72 mb-8" />

        {/* Featured relay — big card */}
        <div className="rounded-2xl bg-surface-100 border border-gold/30 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-5 w-full mb-2" />
          <Skeleton className="h-5 w-4/5 mb-4" />
          <div className="flex -space-x-2 mb-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-9 rounded-full ring-2 ring-surface-100" />
            ))}
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        {/* Hall-of-fame list */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-1.5" />
                  <Skeleton className="h-3 w-1/2 mb-2" />
                  <div className="flex gap-3">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-16" />
                  </div>
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
