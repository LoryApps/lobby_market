import { Skeleton } from '@/components/ui/Skeleton'

export default function QualityTrendLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100" />
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-28 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-8 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    </div>
  )
}
