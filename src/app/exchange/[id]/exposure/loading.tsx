import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ExposureLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        {/* Back + header */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>

        {/* Category positioning */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="grid grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-xl bg-surface-50 border border-surface-300/60 p-4 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Category beta */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <Skeleton className="h-5 w-36" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        </div>

        {/* Correlated markets */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-48" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-surface-300/60 p-3 space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>

        {/* Inversely correlated */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-44" />
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-surface-300/60 p-3 space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>

        {/* Percentiles */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
