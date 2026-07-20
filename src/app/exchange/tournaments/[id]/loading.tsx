import { Skeleton } from '@/components/ui/Skeleton'

export default function TournamentDetailLoading() {
  return (
    <div className="min-h-screen bg-surface-50 pt-16">
      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-7 w-64 mb-2" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-3/4 mb-4" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-4 w-28 mb-2" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2.5 w-20" />
              </div>
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
