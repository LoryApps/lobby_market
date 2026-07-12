import { Skeleton } from '@/components/ui/Skeleton'

function RowSkeleton() {
  return (
    <div className="flex items-start gap-4 px-4 py-3.5 rounded-lg -mx-2">
      <Skeleton className="h-4 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-1 w-full rounded-full" />
      </div>
    </div>
  )
}

function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mb-10">
      <div className="flex items-start gap-4 py-4 border-b border-surface-300">
        <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-3">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <div className="mt-4 space-y-0.5">
        {Array.from({ length: rows }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export default function OrderPaperLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      {/* TopBar skeleton */}
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between flex-shrink-0">
        <Skeleton className="h-7 w-32" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      <main className="flex-1 pb-24">
        <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
          {/* Header skeleton */}
          <div className="mb-8 border-b-2 border-surface-300 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-3 w-12 ml-auto" />
                <Skeleton className="h-4 w-32 ml-auto" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bg-surface-100 border border-surface-300 rounded-xl p-3">
                  <Skeleton className="h-4 w-4 mx-auto mb-2 rounded" />
                  <Skeleton className="h-6 w-8 mx-auto mb-1" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          </div>

          <SectionSkeleton rows={5} />
          <SectionSkeleton rows={3} />
          <SectionSkeleton rows={4} />
        </div>
      </main>
    </div>
  )
}
