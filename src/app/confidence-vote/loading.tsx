import { Skeleton } from '@/components/ui/Skeleton'

export default function ConfidenceVoteLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between flex-shrink-0">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-24">
          <Skeleton className="h-4 w-24" />
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
          <Skeleton className="h-11 rounded-xl" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
