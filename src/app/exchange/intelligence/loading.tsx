import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function IntelligenceLoading() {
  return (
    <>
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-5 w-40 mb-1.5" />
            <Skeleton className="h-3.5 w-56" />
          </div>
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
        <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-5 mb-6 space-y-3">
          <Skeleton className="h-5 w-3/4 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
        </div>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3 w-28 rounded" />
              </div>
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
