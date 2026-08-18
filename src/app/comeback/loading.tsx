import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ComebackLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>

        {/* Stat bar */}
        <div className="flex gap-3 mb-5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 flex-1 rounded-xl" />
          ))}
        </div>

        {/* Debate cards */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full shrink-0" />
              </div>
              {/* Vote bar */}
              <div className="flex gap-1.5">
                <Skeleton className="h-2 rounded-full" style={{ width: `${40 + i * 8}%` }} />
                <Skeleton className="h-2 rounded-full flex-1" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
