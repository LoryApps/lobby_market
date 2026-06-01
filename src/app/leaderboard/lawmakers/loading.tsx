import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LawmakersLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">
        {/* Back + header */}
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-3 w-52" />
          </div>
        </div>

        {/* Filters + timeframe picker */}
        <div className="flex items-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full flex-shrink-0" />
          ))}
          <Skeleton className="h-8 w-8 rounded-lg ml-auto flex-shrink-0" />
        </div>

        {/* Top 3 podium cards */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 0, 2].map((rank) => (
            <div
              key={rank}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface-100 border border-surface-300 ${rank === 0 ? 'border-gold/30' : ''}`}
            >
              <Skeleton className={`rounded-full flex-shrink-0 ${rank === 0 ? 'h-14 w-14' : 'h-10 w-10'}`} />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>

        {/* Ranked list rows 4-25 */}
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300"
            >
              <Skeleton className="h-5 w-6 rounded flex-shrink-0" />
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-5 w-12 ml-auto" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
