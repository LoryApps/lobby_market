import { Skeleton } from '@/components/ui/Skeleton'

export default function AutopsyLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      {/* TopBar */}
      <div className="h-14 border-b border-surface-300 bg-surface-100" />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-20 pb-24">
        <div className="pt-4 space-y-4">
          {/* Breadcrumb */}
          <Skeleton className="h-4 w-28" />

          {/* Header */}
          <div className="space-y-2 mb-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>

          {/* Verdict banner */}
          <Skeleton className="h-32 w-full rounded-2xl" />

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>

          {/* Vote arc */}
          <Skeleton className="h-48 w-full rounded-2xl" />

          {/* Phases */}
          <Skeleton className="h-36 w-full rounded-2xl" />

          {/* Arguments */}
          <Skeleton className="h-64 w-full rounded-2xl" />

          {/* Metrics */}
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </main>
    </div>
  )
}
