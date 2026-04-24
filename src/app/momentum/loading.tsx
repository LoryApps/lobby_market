import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function MomentumLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-0">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-20 pb-24">
        <div className="py-6 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        {/* Stats strip skeleton */}
        <div className="flex gap-3 mb-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 flex-1 rounded-xl" />
          ))}
        </div>
        {/* Topic rows */}
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
