import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ArguisLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-60" />
          </div>
        </div>
        <Skeleton className="h-7 w-full rounded mb-1.5" />
        <Skeleton className="h-7 w-4/5 rounded mb-6" />
        <div className="flex gap-3 mb-8">
          <Skeleton className="flex-1 h-16 rounded-2xl" />
          <Skeleton className="flex-1 h-16 rounded-2xl" />
        </div>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-5/6 rounded" />
              <Skeleton className="h-4 w-4/6 rounded" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-8 w-28 rounded-xl" />
                <Skeleton className="h-8 w-32 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
