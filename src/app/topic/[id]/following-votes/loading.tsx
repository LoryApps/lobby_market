import { Skeleton } from '@/components/ui/Skeleton'

export default function FollowingVotesLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 gap-3 flex-shrink-0">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-40" />
      </div>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6 pb-24">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-7 w-16 rounded-lg" />
          </div>
        ))}
      </main>
    </div>
  )
}
