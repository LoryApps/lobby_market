import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-100 px-4 py-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Skeleton className="h-7 w-48 rounded mb-2" />
        <Skeleton className="h-4 w-72 rounded" />
      </div>
      <div className="flex gap-2 mb-6">
        <Skeleton className="h-8 w-52 rounded-lg" />
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="rounded-xl border border-surface-300 border-l-4 border-l-surface-400 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32 rounded" />
                <Skeleton className="h-3 w-24 rounded" />
              </div>
              <Skeleton className="h-7 w-14 rounded-lg shrink-0" />
            </div>
            <div className="pl-9 space-y-1.5">
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-5/6 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
