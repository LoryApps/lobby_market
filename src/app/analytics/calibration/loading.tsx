import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CalibrationAnalyticsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex items-center gap-5 mb-4">
          <Skeleton className="h-20 w-20 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-2.5 w-10" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-2.5 w-40" />
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-3 mb-4">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-8 w-12" />
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4 space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-36 w-full rounded-lg" />
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-3 w-40 mb-2" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <Skeleton className="h-3.5 w-24 flex-shrink-0" />
              <Skeleton className="h-1.5 flex-1 rounded-full" />
              <Skeleton className="h-3.5 w-10" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
