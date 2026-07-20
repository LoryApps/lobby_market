import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-5 w-24 rounded" />
          <div>
            <Skeleton className="h-7 w-48 rounded mb-2" />
            <Skeleton className="h-4 w-64 rounded" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
