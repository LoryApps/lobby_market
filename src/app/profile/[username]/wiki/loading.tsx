import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ProfileWikiLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto w-full px-4 py-6 pb-24 md:pb-10 space-y-5">
        {/* Back + header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
            <div>
              <Skeleton className="h-5 w-36 mb-1.5" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 py-2 border-b border-surface-300">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Article rows */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4" style={{ width: `${50 + (i % 4) * 13}%` }} />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <div className="flex items-center gap-3 pt-1">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <Skeleton className="h-5 w-8 rounded" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
