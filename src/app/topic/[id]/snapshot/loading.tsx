import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SnapshotLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-10 space-y-4">
        <Skeleton className="h-5 w-32 rounded-lg" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-4 w-3/4 rounded-lg" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <Skeleton className="h-10 w-full rounded-2xl" />
      </main>
      <BottomNav />
    </div>
  )
}
