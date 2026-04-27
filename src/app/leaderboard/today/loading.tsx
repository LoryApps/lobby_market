import { Flame } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TodayLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
            <Flame className="h-5 w-5 text-against-400" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-32 rounded-lg" />
          ))}
        </div>

        {/* Podium */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 0, 2].map((rank) => (
            <div
              key={rank}
              className={`rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col items-center gap-2 ${rank === 0 ? 'ring-1 ring-against-500/30' : ''}`}
            >
              <Skeleton className={`rounded-full flex-shrink-0 ${rank === 0 ? 'h-14 w-14' : 'h-11 w-11'}`} />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>

        {/* List */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-300 last:border-0">
              <Skeleton className="h-4 w-6 flex-shrink-0" />
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-16 flex-shrink-0" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
