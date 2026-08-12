import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function BroadcastLoading() {
  return (
    <div className="min-h-screen bg-surface-0 flex flex-col pb-20">
      <TopBar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-4 w-full rounded-full" />
        <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-surface-300 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-4/5" />
          </div>
          <div className="px-5 py-4">
            <Skeleton className="h-4 w-full rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2.5">
              <Skeleton className="h-9 w-full rounded-t-2xl" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="rounded-xl border border-surface-300 p-3.5 space-y-2 bg-surface-100">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
