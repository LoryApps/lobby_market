import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-10 space-y-5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </main>
      <BottomNav />
    </div>
  )
}
