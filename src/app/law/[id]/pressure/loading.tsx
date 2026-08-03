import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LawPressureLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Header card */}
        <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-4/5" />
          <Skeleton className="h-4 w-32" />
        </div>

        <div className="space-y-5">
          {/* Stability index */}
          <div className="flex gap-4">
            <Skeleton className="h-48 w-48 rounded-2xl flex-shrink-0" />
            <div className="flex-1 rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Skeleton className="h-5 rounded" />
                <Skeleton className="h-5 rounded" />
              </div>
            </div>
          </div>

          {/* Elite vs grassroots */}
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 rounded-full" />
            <Skeleton className="h-6 rounded-full" />
          </div>

          {/* Temporal */}
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 rounded-full" />
            <Skeleton className="h-6 rounded-full" />
          </div>

          {/* Signals */}
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <Skeleton className="h-4 w-36" />
            {[1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
