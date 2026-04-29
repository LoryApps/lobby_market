import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ObservatoryLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="space-y-8">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
