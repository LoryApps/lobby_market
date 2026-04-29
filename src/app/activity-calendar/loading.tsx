import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ActivityCalendarLoading() {
  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-4 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-48 mb-1" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
