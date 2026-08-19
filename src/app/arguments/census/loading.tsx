import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ArgumentCensusLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-5 pb-28 md:pb-12 space-y-5">
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        </div>
        <Skeleton className="h-16 w-full rounded-2xl" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-surface-100 border border-surface-300/60 rounded-2xl p-5 space-y-3">
            <Skeleton className="h-5 w-40" />
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="h-5 w-28 rounded-md" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-1.5 w-full rounded-full" />
                  <Skeleton className="h-1.5 w-3/4 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
