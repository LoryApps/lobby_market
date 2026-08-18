import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LawWikiRecentLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>

        {/* Filter row */}
        <div className="flex gap-2 mb-5">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-24 rounded-lg" />)}
        </div>

        {/* Edit list */}
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300/60">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <div className="flex gap-2 mt-1">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-6 w-16 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
