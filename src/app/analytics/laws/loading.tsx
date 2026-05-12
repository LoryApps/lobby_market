import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LawAnalyticsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3 w-72" />
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>

        {/* Two-column section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-surface-300 p-3 space-y-2 text-center">
                  <Skeleton className="h-4 w-4 mx-auto rounded" />
                  <Skeleton className="h-6 w-10 mx-auto" />
                  <Skeleton className="h-3 w-16 mx-auto" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <Skeleton className="h-4 w-36" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6">
          <Skeleton className="h-4 w-40 mb-5" />
          <div className="flex items-end gap-1 h-28">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <Skeleton className="w-full rounded-t-sm" style={{ height: '40%' }} />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
          <div className="flex border-b border-surface-300">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex-1 py-3 flex justify-center">
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-300 last:border-0">
              <Skeleton className="h-3 w-4 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-16 flex-shrink-0" />
              <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
