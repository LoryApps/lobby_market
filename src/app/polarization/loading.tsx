import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function PolarizationLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-24">
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-52 rounded" />
            <Skeleton className="h-3 w-64 rounded" />
          </div>
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5 space-y-4">
          <Skeleton className="h-16 w-40 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <div className="flex gap-6">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-20 rounded" />
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-5 space-y-2.5">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="flex-1 h-2.5 rounded-full" />
              <Skeleton className="h-3 w-8 rounded" />
            </div>
          ))}
        </div>
        <Skeleton className="h-52 w-full rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
