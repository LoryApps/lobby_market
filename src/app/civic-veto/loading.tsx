import { Skeleton } from '@/components/ui/Skeleton'

export default function CivicVetoLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 bg-surface-100 border-b border-surface-300" />
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>
        {/* Explainer */}
        <Skeleton className="h-16 w-full rounded-xl" />
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        {/* Tabs */}
        <Skeleton className="h-10 w-full rounded-xl" />
        {/* Cards */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-surface-300/50 bg-surface-100 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
