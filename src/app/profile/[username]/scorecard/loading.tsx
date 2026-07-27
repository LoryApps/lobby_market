import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ProfileScorecardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-4 w-28 mb-6" />

        {/* Identity card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            {/* Grade badge */}
            <Skeleton className="h-16 w-16 rounded-xl flex-shrink-0" />
          </div>

          {/* Score display */}
          <div className="text-center mb-6">
            <Skeleton className="h-16 w-28 mx-auto mb-2" />
            <Skeleton className="h-3 w-24 mx-auto" />
          </div>

          {/* Level bar */}
          <div className="mb-6">
            <div className="flex justify-between mb-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>

          {/* Five dimension bars */}
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <Skeleton className="h-7 w-16 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Share button */}
        <Skeleton className="h-11 w-full rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
