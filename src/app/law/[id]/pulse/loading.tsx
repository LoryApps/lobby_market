import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LawPulseLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />
      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-3 w-64 rounded" />
            </div>
          </div>
          <div className="rounded-xl border border-surface-300/40 bg-surface-200/50 p-4 space-y-3">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="grid grid-cols-4 gap-2">
              {[0,1,2,3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          </div>
          {[0,1,2,3,4].map((i) => (
            <div key={i} className="rounded-xl border border-surface-300/30 bg-surface-200/30 p-3.5 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-2.5 w-20 rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </div>
              </div>
              <Skeleton className="h-8 w-full rounded ml-9" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
