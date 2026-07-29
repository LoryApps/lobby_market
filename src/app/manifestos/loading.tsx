import { Skeleton } from '@/components/ui/Skeleton'

function ManifestoCardSkeleton() {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
    </div>
  )
}

export default function ManifestosLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* TopBar skeleton */}
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 space-y-4">
        {/* Header */}
        <div className="space-y-1.5 mb-5">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-80" />
        </div>
        {/* Archetype filter row */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <ManifestoCardSkeleton key={i} />
        ))}
      </main>
    </div>
  )
}
