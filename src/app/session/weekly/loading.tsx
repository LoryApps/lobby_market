import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function WeeklySessionLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Hero */}
        <div className="mb-6 space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        {/* Session card */}
        <Skeleton className="h-40 w-full rounded-2xl mb-6" />
        {/* Agenda items */}
        <Skeleton className="h-5 w-28 mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
