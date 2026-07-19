import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ForecasterProfileLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back link */}
        <Skeleton className="h-5 w-28 mb-5" />

        {/* Profile card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-5">
          <div className="flex items-center gap-4 mb-5">
            <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-60" />
            </div>
            <div className="space-y-2 flex-shrink-0">
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
          </div>
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          {/* Best/worst calls */}
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        </div>

        {/* Category breakdown */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-7 w-full rounded-lg" />
            ))}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg flex-shrink-0" />
          ))}
        </div>

        {/* Forecast cards */}
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
