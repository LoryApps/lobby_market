import { Skeleton } from '@/components/ui/Skeleton'

export default function TagArgumentsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <Skeleton className="h-4 w-48 mb-6" />
        <div className="flex items-start gap-3 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-7 w-20 rounded-full" />)}
          </div>
          <div className="flex gap-1">
            {[1, 2].map((i) => <Skeleton key={i} className="h-7 w-14 rounded-full" />)}
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface-100/50 border border-surface-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-3/4 mb-3" />
              <Skeleton className="h-3 w-2/3 mb-3" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
