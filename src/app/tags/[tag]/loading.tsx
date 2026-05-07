import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TagLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back link */}
        <Skeleton className="h-4 w-20 mb-4" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>

        {/* Sentiment + stats panel */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6 space-y-4">
          {/* Sentiment bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-surface-200/50 border border-surface-300 px-3 py-2.5 text-center space-y-1.5">
                <Skeleton className="h-6 w-8 mx-auto" />
                <Skeleton className="h-2.5 w-14 mx-auto" />
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <div className="flex gap-1.5 flex-wrap">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-7 w-24 rounded-full" />)}
            </div>
          </div>
        </div>

        {/* Related tags */}
        <div className="mb-5 space-y-2">
          <Skeleton className="h-3 w-24" />
          <div className="flex gap-1.5 flex-wrap">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-7 w-20 rounded-full" />)}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 mb-5">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-7 w-14 rounded-full" />)}
        </div>

        {/* Topic cards */}
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-3 w-16 flex-shrink-0" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <div>
                <Skeleton className="h-1 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
