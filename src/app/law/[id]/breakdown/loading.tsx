import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-100">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24 space-y-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-20 rounded-lg" />)}
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
