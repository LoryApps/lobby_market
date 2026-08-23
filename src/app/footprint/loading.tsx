import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function FootprintLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        </div>

        {/* Score hero */}
        <Skeleton className="h-36 w-full rounded-2xl mb-6" />

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>

        {/* Laws section */}
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="space-y-2 mb-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-surface-100 border border-surface-300 p-3 flex items-center gap-3 animate-pulse"
            >
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          ))}
        </div>

        {/* Arguments section */}
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-2 animate-pulse"
            >
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
