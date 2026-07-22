import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DivergenceLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>

        {/* Divergence cards */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <Skeleton className="h-8 w-16 rounded-xl flex-shrink-0" />
            </div>
            <div className="flex gap-2 items-center">
              <Skeleton className="h-3 w-1/2 rounded-full" />
              <Skeleton className="h-3 flex-1 rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full ml-auto" />
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
