import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ProfileTimelineLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-16">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-6 w-36 rounded mb-1" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <div className="flex gap-1.5 mb-6">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-xl flex-shrink-0" />
          ))}
        </div>
        <div className="space-y-2.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
