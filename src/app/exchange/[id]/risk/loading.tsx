import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function RiskLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Overall risk score */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-3 text-center">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-16 w-24 mx-auto rounded-2xl" />
          <Skeleton className="h-4 w-40 mx-auto" />
        </div>

        {/* Six risk dimensions */}
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-lg" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
