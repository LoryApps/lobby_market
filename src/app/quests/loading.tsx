import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function QuestsLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
