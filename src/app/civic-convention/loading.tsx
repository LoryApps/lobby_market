import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CivicConventionLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-24 md:pb-10 space-y-6">
        {/* Back + header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div>
            <Skeleton className="h-7 w-56 mb-1.5" />
            <Skeleton className="h-3 w-72" />
          </div>
        </div>

        {/* Status banner */}
        <div className="rounded-2xl bg-surface-200 border border-surface-300 p-4 flex items-center gap-4">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg flex-shrink-0" />
        </div>

        {/* Seven articles */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-40 mb-3" />
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-4 rounded-xl bg-surface-200 border border-surface-300"
            >
              <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4" style={{ width: `${45 + (i % 4) * 12}%` }} />
                <Skeleton className="h-3 w-full" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />
            </div>
          ))}
        </div>

        {/* Propose amendment section */}
        <div className="rounded-2xl bg-surface-200 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-9 w-40 rounded-lg mt-1" />
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
