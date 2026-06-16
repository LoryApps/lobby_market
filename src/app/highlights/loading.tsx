import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-100 pb-24">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-20 space-y-6">
        <div className="text-center space-y-2 pt-4">
          <Skeleton className="h-4 w-40 mx-auto" />
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>

        {/* Stats strip skeleton */}
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-200 p-3 space-y-1.5">
              <Skeleton className="h-3 w-16 mx-auto" />
              <Skeleton className="h-6 w-10 mx-auto" />
            </div>
          ))}
        </div>

        {/* Filter pills skeleton */}
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-24 rounded-full" />
          ))}
        </div>

        <div className="flex gap-6">
          {/* Cards */}
          <div className="flex-1 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-surface-300 bg-surface-200 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </div>
                <div className="rounded-lg bg-surface-300 p-3 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-6 h-6 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar skeleton (desktop) */}
          <div className="hidden lg:block w-72 space-y-4 flex-shrink-0">
            <div className="rounded-2xl border border-surface-300 bg-surface-200 p-4 space-y-3">
              <Skeleton className="h-4 w-32" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
