import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CivicMirrorLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-28">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-1 flex-1 rounded-full" />)}
          </div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
