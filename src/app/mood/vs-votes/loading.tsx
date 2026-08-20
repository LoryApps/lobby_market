import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function MoodVsVotesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-10">
        <div className="flex items-center gap-2 mb-5">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-40 rounded" />
        </div>
        <Skeleton className="h-4 w-full rounded mb-1" />
        <Skeleton className="h-4 w-3/4 rounded mb-6" />
        <div className="flex gap-1.5 mb-5">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <Skeleton className="h-36 w-full rounded-2xl mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
