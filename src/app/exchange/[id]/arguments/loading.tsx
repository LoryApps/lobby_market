import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-950 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-full" />
        <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-28 rounded-lg" />
          <Skeleton className="h-7 w-32 rounded-lg ml-auto" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-3 w-8" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
