import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ContestedLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-36 rounded" />
            <Skeleton className="h-3 w-48 rounded" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-20 rounded-xl" />)}
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-2/3 rounded" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
