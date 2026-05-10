import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopScoredLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Header skeleton */}
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        {/* Filter skeleton */}
        <div className="mb-5 space-y-2.5">
          {[72, 88, 64].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-12 flex-shrink-0" />
              {[w, w - 12, w + 8].map((pw, j) => (
                <Skeleton key={j} className={`h-7 rounded-full`} style={{ width: `${pw}px` }} />
              ))}
            </div>
          ))}
        </div>

        {/* Argument skeletons */}
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3 animate-pulse"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-surface-300 flex-shrink-0" />
                <div className="h-8 w-8 rounded-lg bg-surface-300 flex-shrink-0" />
                <div className="flex items-center gap-1.5 flex-1">
                  <div className="h-5 w-5 rounded-full bg-surface-300" />
                  <div className="h-3 w-28 bg-surface-300 rounded" />
                </div>
                <div className="h-5 w-16 bg-surface-300 rounded-full" />
              </div>
              <div className="h-1.5 w-full bg-surface-300 rounded-full" />
              <div className="space-y-2">
                <div className="h-3.5 w-full bg-surface-300 rounded" />
                <div className="h-3.5 w-11/12 bg-surface-300 rounded" />
                <div className="h-3.5 w-3/4 bg-surface-300 rounded" />
              </div>
              <div className="flex items-center justify-between">
                <div className="h-2.5 w-16 bg-surface-300 rounded" />
                <div className="h-2.5 w-40 bg-surface-300 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
