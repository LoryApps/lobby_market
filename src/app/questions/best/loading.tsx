import { Skeleton } from '@/components/ui/Skeleton'

export default function BestAnswersLoading() {
  return (
    <div className="min-h-screen bg-surface-0 pb-20">
      <div className="sticky top-0 z-40 bg-surface-0/95 backdrop-blur border-b border-surface-300 h-14" />
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
