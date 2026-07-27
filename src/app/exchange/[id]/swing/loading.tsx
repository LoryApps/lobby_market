import { Skeleton } from '@/components/ui/Skeleton'

export default function SwingLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 bg-surface-100 border-b border-surface-300" />
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-24">
        <Skeleton className="h-6 w-52 mb-1" />
        <Skeleton className="h-4 w-80 mb-8" />

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>

        {/* Swing list */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <Skeleton className="h-4 w-40 mb-4" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl mb-3" />
          ))}
        </div>
      </div>
    </div>
  )
}
