import { CalendarDays } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function RankRowSkeleton({ podium }: { podium?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 ${podium ? 'py-3' : 'py-2.5'} border-b border-surface-300/50`}>
      <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
      <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
  )
}

export default function YearLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 flex-shrink-0">
              <CalendarDays className="h-4 w-4 text-surface-500" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          </div>
          {/* Year nav */}
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 p-1 bg-surface-200 rounded-xl mb-5">
          {[68, 72, 88, 82].map((w, i) => (
            <Skeleton key={i} className="h-8 rounded-lg flex-1" />
          ))}
        </div>

        {/* Podium top 3 */}
        <div className="flex items-end justify-center gap-3 mb-6 px-4">
          <div className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-3 w-16" />
            <div className="h-12 w-20 rounded-t-xl bg-surface-300/50" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-3 w-20" />
            <div className="h-20 w-24 rounded-t-xl bg-surface-300/50" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-3 w-16" />
            <div className="h-8 w-20 rounded-t-xl bg-surface-300/50" />
          </div>
        </div>

        {/* Rank list */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <RankRowSkeleton key={i} podium={i < 3} />
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
