import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function RelayIntelligenceLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-5">
        {/* Back + header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>

        {/* Intel score card */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="flex items-end gap-3">
            <Skeleton className="h-14 w-20" />
            <Skeleton className="h-6 w-24 rounded-full mb-1" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-3 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>

        {/* Community verdict */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-3">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-12 flex-1 rounded-xl" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>

        {/* Leg breakdown */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-4">
          <Skeleton className="h-5 w-32" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3 pt-3 border-t border-surface-300 first:border-0 first:pt-0">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="flex gap-2">
                  <Skeleton className="h-3 w-16 rounded-full" />
                  <Skeleton className="h-3 w-20 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contributors */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
          <Skeleton className="h-5 w-36" />
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-7 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
