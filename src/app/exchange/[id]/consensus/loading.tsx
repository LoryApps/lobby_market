import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ConsensusLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-52" />
        </div>

        {/* Consensus meter */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
          <Skeleton className="h-5 w-40" />
          <div className="flex justify-between text-xs">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-4 w-full rounded-full" />
          <div className="text-center">
            <Skeleton className="h-8 w-24 mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto mt-1.5" />
          </div>
        </div>

        {/* Forecaster consensus breakdown */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-48" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full rounded-full" />
              </div>
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          ))}
        </div>

        {/* Coalition stances */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-surface-300/30">
              <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
