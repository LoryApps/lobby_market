import { Skeleton } from '@/components/ui/Skeleton'

export default function RelayInvitationsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-48 rounded" />
            <Skeleton className="h-3.5 w-64 rounded" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-xl mb-4" />
        <div className="flex gap-1.5 mb-5">
          {[0,1,2,3,4].map(i => <Skeleton key={i} className="h-7 w-16 rounded-lg" />)}
        </div>
        <div className="space-y-3">
          {[0,1,2].map(i => (
            <div key={i} className="rounded-2xl border border-surface-300/60 bg-surface-100 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
