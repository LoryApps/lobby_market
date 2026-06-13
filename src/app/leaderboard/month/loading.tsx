import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function MonthlyLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">
        <div className="mb-6 flex items-start gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-3.5 w-36" />
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <Skeleton className="h-7 flex-1" />
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
        </div>

        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
          {[20, 20, 24, 24].map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-lg flex-shrink-0" />
          ))}
        </div>

        <Skeleton className="h-11 w-full rounded-xl mb-4" />

        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/50">
              <Skeleton className="h-4 w-6 flex-shrink-0" />
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-4 w-10 ml-auto" />
                <Skeleton className="h-3 w-8 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
