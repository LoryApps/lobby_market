import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function AnatomyLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        {/* Back + header */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* FOR vs AGAINST overview */}
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-3 w-full rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>

        {/* Argument length distribution */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <Skeleton className="h-5 w-48" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-surface-50 border border-surface-300/60 p-3 space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-10" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* AI grade distribution */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-1 space-y-1.5">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Citation + engagement */}
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>

        {/* Top words */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-36" />
          <div className="flex flex-wrap gap-2">
            {[100, 80, 120, 70, 90, 110, 75, 85].map((w, i) => (
              <Skeleton key={i} className={`h-7 rounded-full`} style={{ width: w }} />
            ))}
          </div>
        </div>

        {/* Top argument per side */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <Skeleton className="h-5 w-40" />
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-surface-300/60 p-4 space-y-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-14" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
