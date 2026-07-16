import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SmartMoneyLoading() {
  return (
    <>
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-4 w-36 mb-1.5" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
        </div>

        {/* Aggregate row */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <Skeleton className="h-7 w-10 mx-auto mb-1.5" />
              <Skeleton className="h-2.5 w-16 mx-auto" />
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Skeleton className="h-11 w-full rounded-xl mb-5" />

        {/* Signal cards */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
              <div className="flex items-start gap-3 mb-3">
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-full mb-1.5" />
                  <Skeleton className="h-3.5 w-3/4 mb-2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-6 w-12 flex-shrink-0" />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1.5">
                  {[1, 2, 3].map((j) => (
                    <Skeleton key={j} className="h-6 w-6 rounded-full" />
                  ))}
                </div>
                <Skeleton className="h-4 w-20 ml-2" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
