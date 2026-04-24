import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CompareLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 rounded" />
            <Skeleton className="h-4 w-72 rounded" />
          </div>
        </div>

        {/* Topic pickers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
              <Skeleton className="h-5 w-20 rounded" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <div className="space-y-2">
                {[0, 1, 2].map((j) => (
                  <Skeleton key={j} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Comparison stats panel */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 space-y-4">
          <Skeleton className="h-5 w-40 rounded mb-2" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-surface-200 border border-surface-300 p-4 space-y-2">
                <Skeleton className="h-3 w-16 rounded mx-auto" />
                <Skeleton className="h-8 w-24 rounded mx-auto" />
                <Skeleton className="h-3 w-20 rounded mx-auto" />
              </div>
            ))}
          </div>
          {/* Vote bars */}
          <div className="space-y-3 mt-4">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-32 rounded" />
                  <Skeleton className="h-3 w-12 rounded" />
                </div>
                <Skeleton className="h-3 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
