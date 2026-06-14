import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ExploreLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-10 w-full rounded-xl mb-4" />
        <div className="flex gap-2 mb-5">
          {[80, 60, 90, 70, 80, 65, 75].map((w, i) => (
            <Skeleton key={i} className="h-7 rounded-full flex-shrink-0" style={{ width: w }} />
          ))}
        </div>
        <div className="space-y-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((j) => (
                  <Skeleton key={j} className="h-16 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
