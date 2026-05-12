import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ArgumentAnalyticsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <Skeleton className="h-5 w-36 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-28 rounded-xl" />
          <div className="grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
