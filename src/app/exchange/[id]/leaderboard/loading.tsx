import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-52" />
        </div>

        {/* Top 3 podium */}
        <div className="flex items-end justify-center gap-3 py-4">
          {[60, 80, 50].map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className={`w-20 rounded-t-lg`} style={{ height: h }} />
            </div>
          ))}
        </div>

        {/* Ranked list */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="text-right space-y-1">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-3 w-10" />
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
