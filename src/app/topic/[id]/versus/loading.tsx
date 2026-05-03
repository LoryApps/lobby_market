import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function VersusLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-full max-w-md rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        </div>

        {/* Vote bar */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-5">
          <Skeleton className="h-4 w-full rounded-full mb-2" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
        </div>

        {/* FOR vs AGAINST columns */}
        <div className="grid grid-cols-2 gap-3">
          {['FOR', 'AGAINST'].map((side) => (
            <div key={side} className="space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-lg" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-3 w-20 rounded" />
                  </div>
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-12 rounded-lg" />
                    <Skeleton className="h-6 w-16 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
