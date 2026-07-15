import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function WatchlistLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <div className="sticky top-14 z-30 bg-surface-50/95 border-b border-surface-300 px-4 py-3">
        <Skeleton className="h-6 w-40 rounded" />
      </div>
      <main className="max-w-3xl mx-auto px-4 pt-5 pb-28 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
