import { Skeleton } from '@/components/ui/Skeleton'

export default function DebateExploreLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-28 space-y-6">
        <Skeleton className="h-4 w-28" />
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-md" />
          </div>
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-surface-300/40 p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
