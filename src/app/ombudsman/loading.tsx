import { Skeleton } from '@/components/ui/Skeleton'

export default function OmbudsmanLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-28">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
        </div>
        <div className="flex gap-3 mb-5">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-20 rounded-lg" />)}
        </div>
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-24 rounded-lg" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      </div>
    </div>
  )
}
