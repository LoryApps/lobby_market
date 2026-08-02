import { Skeleton } from '@/components/ui/Skeleton'

export default function LawChallengesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
        <Skeleton className="h-4 w-28 mb-4" />
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-6">
          {[0,1,2,3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <Skeleton className="h-6 w-8 mx-auto mb-1" />
              <Skeleton className="h-2.5 w-12 mx-auto" />
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl ml-auto" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>

        <div className="flex gap-2 mb-4 overflow-hidden">
          {[0,1,2,3,4,5].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>

        <div className="space-y-3">
          {[0,1,2,3].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
              <Skeleton className="h-14 w-full rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/6" />
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex gap-1.5">
                  <Skeleton className="h-8 w-16 rounded-lg" />
                  <Skeleton className="h-8 w-16 rounded-lg" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
