import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CoalitionDebatesLoading() {
  return (
    <div className="min-h-screen bg-surface-950">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-5">
        <Skeleton className="h-4 w-28 rounded-lg" />
        <Skeleton className="h-7 w-44 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-11 rounded-xl" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
