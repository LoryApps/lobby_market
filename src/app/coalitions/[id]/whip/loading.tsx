import { Skeleton } from '@/components/ui/Skeleton'

export default function WhipLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-28 rounded-xl" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <div className="space-y-3">
        {[1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
      </div>
    </div>
  )
}
