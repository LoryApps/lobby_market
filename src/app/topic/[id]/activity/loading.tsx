import { Skeleton } from '@/components/ui/Skeleton'

export default function ActivityLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 bg-surface-100 border-b border-surface-300" />
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        <Skeleton className="h-4 w-16 mb-4" />
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
        <div className="bg-surface-100 rounded-2xl border border-surface-300 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 space-y-2 border-b border-surface-300/40">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-12 ml-auto" />
              </div>
              <div className="pl-7">
                <Skeleton className="h-5 w-36 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
