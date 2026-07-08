import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LawRatingsLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto w-full px-4 py-6 pb-24 md:pb-10 space-y-5">
        {/* Back + header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div>
            <Skeleton className="h-7 w-48 mb-1.5" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1.5">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Rating form placeholder */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-10 rounded-xl flex-shrink-0" />
            ))}
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        {/* Review list */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-32 mb-1" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-24" />
                    <div className="flex gap-0.5 ml-1">
                      {[1, 2, 3, 4, 5].map((j) => (
                        <Skeleton key={j} className="h-3 w-3 rounded-sm" />
                      ))}
                    </div>
                    <Skeleton className="h-3 w-14 ml-auto" />
                  </div>
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-4/5" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
