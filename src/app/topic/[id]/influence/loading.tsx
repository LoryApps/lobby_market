import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function InfluenceLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-5 w-16 rounded-full mb-2" />
        <Skeleton className="h-7 w-full mb-1" />
        <Skeleton className="h-7 w-4/5 mb-3" />
        <Skeleton className="h-1.5 w-full rounded-full mb-6" />
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-24 rounded-2xl mb-5" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
