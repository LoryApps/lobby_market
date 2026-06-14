import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LawReviewsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-100 border border-surface-300 rounded-xl px-4 py-3 space-y-1.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>

        {/* Sort pills */}
        <div className="flex gap-2 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Review cards */}
        <div className="space-y-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2.5 w-14" />
                  </div>
                </div>
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
