import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ConsensusMapLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-6">
          <Skeleton className="h-6 w-44 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4">
          <Skeleton className="h-4 w-44 mb-4" />
          <Skeleton className="h-5 w-full rounded-full mb-3" />
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4">
          <Skeleton className="h-4 w-36 mb-3" />
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
