import { Skeleton } from '@/components/ui/Skeleton'

export default function ForecastLoading() {
  return (
    <div className="min-h-screen bg-surface-50 max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    </div>
  )
}
