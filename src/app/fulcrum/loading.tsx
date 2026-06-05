import { Skeleton } from '@/components/ui/Skeleton'

export default function FulcrumLoading() {
  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-7 w-56 rounded-xl" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
        </div>

        {/* Stats bar */}
        <Skeleton className="h-5 w-72 rounded" />

        {/* Cards */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-surface-200 bg-surface-100 overflow-hidden">
            <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-surface-200">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 flex gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-4 w-8 rounded" />
            </div>
            <div className="px-4 py-3 space-y-2">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-4/5 rounded" />
            </div>
            <div className="px-4 pb-3 space-y-1.5">
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
            <div className="px-4 pb-3 flex gap-4">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
            <div className="border-t border-surface-200 px-4 py-2.5">
              <Skeleton className="h-4 w-40 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
