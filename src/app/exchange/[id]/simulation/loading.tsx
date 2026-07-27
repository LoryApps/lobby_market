import { Skeleton } from '@/components/ui/Skeleton'

export default function SimulationLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 bg-surface-100 border-b border-surface-300" />
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-24">
        <Skeleton className="h-6 w-48 mb-1" />
        <Skeleton className="h-4 w-72 mb-8" />
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-10 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-6" />
          <Skeleton className="h-4 w-40 mb-3" />
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4">
          <Skeleton className="h-4 w-36 mb-4" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <Skeleton className="h-4 w-28 mb-4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  )
}
