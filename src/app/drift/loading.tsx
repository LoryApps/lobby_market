import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DriftLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 pb-24">
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-36 rounded" />
            <Skeleton className="h-3 w-64 rounded" />
          </div>
        </div>
        <div className="flex gap-2 mb-5">
          {[0,1,2,3,4].map(i => <Skeleton key={i} className="h-7 w-24 rounded-full flex-shrink-0" />)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[0,1,2,3].map(i => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-2">
              <Skeleton className="h-5 w-24 rounded" />
              <Skeleton className="h-3 w-32 rounded" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-3 w-40 rounded" />
                </div>
              </div>
              <Skeleton className="h-9 w-full rounded" />
              <Skeleton className="h-20 w-full rounded" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
