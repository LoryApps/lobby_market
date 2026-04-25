import { Skeleton } from '@/components/ui/Skeleton'

export default function StreaksLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-40 rounded" />
            <Skeleton className="h-4 w-56 rounded" />
          </div>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        {/* Podium */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
          <Skeleton className="h-4 w-24 rounded mb-5" />
          <div className="flex items-end justify-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-36 w-24 rounded-t-lg" />
            </div>
            <div className="flex flex-col items-center gap-2 -mt-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-44 w-24 rounded-t-lg" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-32 w-24 rounded-t-lg" />
            </div>
          </div>
        </div>
        {/* List */}
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
