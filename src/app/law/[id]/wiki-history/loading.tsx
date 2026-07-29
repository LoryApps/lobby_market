import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LawWikiHistoryLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24 pt-2">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-3 rounded" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-3 rounded" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24 rounded-xl" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
