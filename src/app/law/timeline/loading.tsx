import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LawTimelineLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Stats strip skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-4 h-20 animate-pulse"
            />
          ))}
        </div>

        {/* Search + filter skeleton */}
        <div className="mb-6 space-y-3">
          <div className="h-10 rounded-xl bg-surface-200 animate-pulse" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 w-20 rounded-full bg-surface-200 animate-pulse" />
            ))}
          </div>
        </div>

        {/* Timeline skeleton */}
        {[1, 2].map((group) => (
          <div key={group} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-7 w-7 rounded-lg bg-surface-200 animate-pulse" />
              <div className="h-4 w-32 bg-surface-200 animate-pulse rounded" />
              <div className="flex-1 h-px bg-surface-300" />
            </div>
            <div className="pl-2 space-y-4">
              {Array.from({ length: group === 1 ? 3 : 2 }).map((_, i) => (
                <div
                  key={i}
                  className="flex gap-4"
                >
                  <div className="flex flex-col items-center flex-shrink-0 w-5">
                    <div className="h-3 w-3 rounded-full bg-surface-300 animate-pulse mt-1" />
                    <div className="flex-1 w-px bg-surface-300 mt-1" />
                  </div>
                  <div className="flex-1 rounded-xl bg-surface-100 border border-surface-300 p-4 h-20 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
