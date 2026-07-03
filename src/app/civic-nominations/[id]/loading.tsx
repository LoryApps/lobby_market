import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function NominationDetailLoading() {
  return (
    <>
      <div className="min-h-screen bg-surface-0">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-20 pb-24 md:pb-8">
          {/* Back nav skeleton */}
          <Skeleton className="h-4 w-32 mb-6" />

          {/* Role header card */}
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-12 w-12 rounded-2xl flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-3 w-full mb-2" />
            <Skeleton className="h-3 w-5/6 mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>

          {/* Progress + endorse button */}
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-2 w-full rounded-full mb-4" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>

          {/* Nominee card */}
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-4">
            <Skeleton className="h-3 w-20 mb-4" />
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-5 w-36 mb-2" />
                <Skeleton className="h-3 w-24 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          </div>

          {/* Statement */}
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-4">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-3 w-full mb-2" />
            <Skeleton className="h-3 w-full mb-2" />
            <Skeleton className="h-3 w-4/5" />
          </div>

          {/* Endorsers */}
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
            <Skeleton className="h-3 w-24 mb-4" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-3 border-b border-surface-300 last:border-0">
                <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-3 w-28 mb-1.5" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
                <Skeleton className="h-2.5 w-14" />
              </div>
            ))}
          </div>
        </main>
      </div>
      <BottomNav />
    </>
  )
}
