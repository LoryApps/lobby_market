import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24 space-y-8">
        {/* back + header */}
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-48" />
          <div className="rounded-xl border border-surface-300/40 bg-surface-200/30 p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        </div>

        {/* Section 1 */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300/40 bg-surface-200/30 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-8 w-14 rounded-lg flex-shrink-0" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>

        {/* Section 2 */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-48" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300/40 bg-surface-200/30 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="h-8 w-14 rounded-lg flex-shrink-0" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-4 w-24 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
