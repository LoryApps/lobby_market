import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ArenaLeaderboardLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto w-full px-4 py-6 pb-24 md:pb-10 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div>
            <Skeleton className="h-7 w-52 mb-1.5" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>

        {/* Top 3 podium */}
        <div className="grid grid-cols-3 gap-3">
          {/* 2nd */}
          <div className="flex flex-col items-center gap-2 pt-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
          {/* 1st */}
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-6 w-6 rounded mb-1" />
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
          {/* 3rd */}
          <div className="flex flex-col items-center gap-2 pt-8">
            <Skeleton className="h-11 w-11 rounded-full" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Leaderboard rows */}
        <div className="space-y-2">
          {[4, 5, 6, 7, 8, 9, 10].map((rank) => (
            <div
              key={rank}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300"
            >
              <Skeleton className="h-5 w-6 flex-shrink-0" />
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <div className="flex gap-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-4 w-14 ml-auto" />
                <Skeleton className="h-3 w-12 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
