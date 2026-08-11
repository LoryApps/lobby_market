import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function LawCardSkeleton() {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      {/* Heat tier badge + score */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-7 w-12 rounded-lg flex-shrink-0" />
      </div>

      {/* Statement */}
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-14" />
      </div>

      {/* Vote bar */}
      <Skeleton className="h-2 w-full rounded-full" />

      {/* Vote % labels */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-14" />
      </div>

      {/* CTA row */}
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-3.5 w-16" />
      </div>
    </div>
  )
}

export default function AfterglowLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="space-y-1.5 mt-2">
            <Skeleton className="h-3.5 w-full max-w-md" />
            <Skeleton className="h-3.5 w-3/4 max-w-sm" />
          </div>
        </div>

        {/* Sort controls */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Sort tabs */}
          <div className="flex items-center gap-1 bg-surface-100 border border-surface-300 rounded-xl p-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-16 rounded-lg" />
            ))}
          </div>
          {/* Window picker */}
          <div className="flex items-center gap-1 bg-surface-100 border border-surface-300 rounded-xl p-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-10 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Law cards */}
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <LawCardSkeleton key={i} />
          ))}
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
