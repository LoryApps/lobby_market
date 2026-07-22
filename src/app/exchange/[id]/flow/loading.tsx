import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function FlowLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        {/* Back + header */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-60" />
        </div>

        {/* Market price header */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-12 w-12 rounded-xl" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>

        {/* Flow chart area */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-6 w-14 rounded-lg" />
              ))}
            </div>
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>

        {/* Flow metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-14" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>

        {/* Volume breakdown */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <Skeleton className="h-5 w-40" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 flex-1 rounded-full" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>

        {/* Price inflection points */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-44" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-surface-300/30">
              <Skeleton className="h-5 w-5 rounded-full flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
