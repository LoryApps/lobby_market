import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ActivityLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-44" />
        </div>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2 pt-0.5">
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
