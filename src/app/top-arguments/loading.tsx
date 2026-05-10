import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TopArgumentsLoading() {
  return (
    <div className="min-h-screen bg-surface-100">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-20 pb-24">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2 mb-4 flex-wrap">
          {[80, 64, 64, 80, 80].map((w, i) => (
            <Skeleton key={i} className="h-8 rounded-full" style={{ width: w }} />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-surface-300/30 bg-surface-200/40 animate-pulse">
              <div className="flex gap-3">
                <Skeleton className="h-2.5 w-2.5 rounded-full mt-1.5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2 items-center">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-4 w-4 rounded" />
                  </div>
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-5/6" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
