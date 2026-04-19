import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/60 ${className ?? ''}`} />
}

export default function PositionsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <Sk className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Sk className="h-5 w-28" />
            <Sk className="h-3 w-44" />
          </div>
        </div>

        {/* Stats card skeleton */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sk className="h-8 w-8 rounded-lg" />
            <div className="space-y-1.5">
              <Sk className="h-4 w-32" />
              <Sk className="h-3 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-surface-200 border border-surface-300 p-3">
                <Sk className="h-7 w-10 mx-auto mb-1.5" />
                <Sk className="h-2.5 w-14 mx-auto" />
              </div>
            ))}
          </div>
          <Sk className="h-1.5 w-full rounded-full mt-4" />
        </div>

        {/* Filter tabs skeleton */}
        <div className="flex gap-2 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {[0, 1, 2, 3].map((i) => (
            <Sk key={i} className="h-8 w-20 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Position cards skeleton */}
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-5 animate-pulse"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <Sk className="h-4 w-16 rounded-full" />
                <Sk className="h-4 w-20 rounded-full" />
              </div>
              <div className="space-y-2 mb-4">
                <Sk className="h-4 w-full" />
                <Sk className="h-4 w-3/4" />
              </div>
              <Sk className="h-2 w-full rounded-full" />
              <div className="flex items-center justify-between mt-3">
                <Sk className="h-3 w-24" />
                <Sk className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
